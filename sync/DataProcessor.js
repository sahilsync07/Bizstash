const fs = require('fs-extra');
const path = require('path');
const xml2js = require('xml2js');
const { parse, differenceInDays } = require('date-fns');
const CONFIG = require('./config');
const Logger = require('./utils/Logger');

class DataProcessor {
    constructor(companyName) {
        this.companyName = companyName;

        let relativePath = 'xml';
        if (companyName && companyName !== 'default_company') {
            relativePath = path.join('xml', companyName);
        }

        this.baseDir = path.resolve(CONFIG.PATHS.ROOT, 'tally_data', relativePath);
        this.mastersDir = path.join(this.baseDir, 'masters');
        this.vouchersDir = path.join(this.baseDir, 'vouchers');
        this.outputDir = path.join(CONFIG.PATHS.OUTPUT_DATA, companyName);
    }

    async process() {
        Logger.info(`Processing data for ${this.companyName}...`);
        await fs.ensureDir(this.outputDir);

        const masters = await this._parseMasters();
        const analysis = await this._parseVouchers(masters);

        await this._saveData(masters, analysis);
        await this._updateCompanyIndex();

        Logger.success('Data Processing Complete.');
    }

    // --- MASTERS (from groups.xml and ledgers.xml) ---
    async _parseMasters() {
        const groupsFile = path.join(this.mastersDir, 'groups.xml');
        const ledgersFile = path.join(this.mastersDir, 'ledgers.xml');

        const groups = {};
        const ledgers = {};

        // Helper to parse Collection XML
        const parseCollection = async (file, itemTag, mapFn) => {
            if (!fs.existsSync(file)) return;
            try {
                const xmlData = await fs.readFile(file, 'utf8');
                const parser = new xml2js.Parser({ explicitArray: false, attrkey: '$' });
                const result = await parser.parseStringPromise(xmlData);

                let items = result?.ENVELOPE?.BODY?.DATA?.COLLECTION?.[itemTag] || [];
                if (!Array.isArray(items)) items = [items];

                items.forEach(mapFn);
            } catch (e) {
                Logger.error(`Failed to parse ${path.basename(file)}`, e);
            }
        };

        // 1. Parse Groups
        await parseCollection(groupsFile, 'GROUP', (g) => {
            const name = g.$?.NAME || this._getText(g.NAME);
            if (name) {
                groups[name] = {
                    name,
                    parent: this._getText(g.PARENT)
                };
            }
        });

        // 2. Parse Ledgers
        await parseCollection(ledgersFile, 'LEDGER', (l) => {
            const name = l.$?.NAME || this._getText(l.NAME);
            if (name) {
                // Tally Opening Balance: Credit is negative, Debit is positive normally?
                // Actually in Collection Export:
                // Debit = Positive Number
                // Credit = Negative Number (e.g. -1000)
                // We use parseFloat directly.
                const opBal = parseFloat(this._getText(l.OPENINGBALANCE) || 0);
                ledgers[name] = {
                    name,
                    parent: this._getText(l.PARENT),
                    openingBalance: opBal
                };
            }
        });

        // Resolve Root Groups
        const findRootGroup = (groupName) => {
            if (!groupName) return 'Unknown';
            if (groupName === 'Sundry Debtors' || groupName === 'Sundry Creditors') return groupName;
            const parent = groups[groupName]?.parent;
            if (!parent || parent === '') return groupName;
            return findRootGroup(parent);
        };

        Object.values(ledgers).forEach(l => {
            l.rootGroup = findRootGroup(l.parent);
        });

        Logger.info(`Parsed ${Object.keys(ledgers).length} Ledgers, ${Object.keys(groups).length} Groups.`);
        return { ledgers, groups };
    }

    _buildMastersStructure(msgArray) {
        // Obsolete method, kept for reference or safe deletion if unused.
        return { ledgers: {}, groups: {} };
    }

    // --- VOUCHERS (from single vouchers.xml) ---
    async _parseVouchers(masters) {
        const vouchersFile = path.join(this.vouchersDir, 'vouchers.xml');

        if (!fs.existsSync(vouchersFile)) {
            Logger.warn('No vouchers.xml found.');
            return this._emptyAnalysis();
        }

        Logger.info('Parsing vouchers.xml...');
        const startTime = Date.now();

        try {
            const xmlData = await fs.readFile(vouchersFile, 'utf8');
            const sizeMB = (xmlData.length / 1024 / 1024).toFixed(1);
            Logger.info(`Loaded ${sizeMB} MB. Parsing XML...`);

            const parser = new xml2js.Parser({ explicitArray: false, attrkey: '$' });
            const result = await parser.parseStringPromise(xmlData);

            // Structure: ENVELOPE > BODY > DATA > COLLECTION > VOUCHER[]
            let vouchers = result?.ENVELOPE?.BODY?.DATA?.COLLECTION?.VOUCHER || [];
            if (!Array.isArray(vouchers)) vouchers = [vouchers];

            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            Logger.info(`Parsed ${vouchers.length.toLocaleString()} vouchers in ${elapsed}s.`);

            return this._analyzeVouchers(vouchers, masters);

        } catch (e) {
            Logger.error('Failed to parse vouchers.xml', e);
            return this._emptyAnalysis();
        }
    }

    _analyzeVouchers(vouchers, masters) {
        const monthlyStats = {};
        const stockStats = {};
        const ledgerBalances = {};
        const allTransactions = [];
        const today = new Date();

        // Init ledger balances from masters
        Object.values(masters.ledgers).forEach(l => {
            if (l.rootGroup === 'Sundry Debtors' || l.rootGroup === 'Sundry Creditors') {
                ledgerBalances[l.name] = {
                    balance: l.openingBalance || 0,
                    billRefs: [],
                    group: l.rootGroup,
                    parent: l.parent
                };
            }
        });

        vouchers.forEach(v => {
            // XML Collection format: DATE is in element or attribute
            const dateStr = this._getText(v.DATE); // YYYYMMDD
            if (!dateStr) return;

            const month = dateStr.substring(0, 6);
            const voucherDate = parse(dateStr, 'yyyyMMdd', new Date());
            const vType = this._getText(v.VOUCHERTYPENAME); // Keep original case for display
            const vTypeLower = (vType || '').toLowerCase(); // Lowercase for logic

            const transaction = {
                date: dateStr,
                type: vType,
                number: this._getText(v.VOUCHERNUMBER),
                party: this._getText(v.PARTYLEDGERNAME),
                amount: parseFloat(this._getText(v.AMOUNT) || 0),
                ledgers: []
            };

            // --- REVENUE & PURCHASE (Updated to match Tally Registers D-A-S / D-A-P) ---
            // User requested to see the "Register Total" which is Gross (Incl Tax).
            const voucherTotal = Math.abs(parseFloat(this._getText(v.AMOUNT) || 0));

            if (vTypeLower.includes('sales') || vTypeLower.includes('tax invoice')) {
                if (!monthlyStats[month]) monthlyStats[month] = { sales: 0, purchase: 0 };
                monthlyStats[month].sales += voucherTotal;

            } else if (vTypeLower.includes('purchase')) {
                if (!monthlyStats[month]) monthlyStats[month] = { sales: 0, purchase: 0 };
                monthlyStats[month].purchase += voucherTotal;

            } else if (vTypeLower.includes('credit note') || vTypeLower.includes('debit note')) {
                // Ignore Returns to match Tally "Register" Gross Totals (D-A-S / D-A-P)
            }

            // --- Inventory Entries (Stock Analysis Only) ---
            let invEntries = v['ALLINVENTORYENTRIES.LIST'];
            if (invEntries && !Array.isArray(invEntries)) invEntries = [invEntries];

            if (invEntries) {
                invEntries.forEach(item => {
                    const amt = Math.abs(parseFloat(this._getText(item.AMOUNT) || 0));
                    const qty = Math.abs(parseFloat(this._getText(item.BILLEDQTY) || this._getText(item.ACTUALQTY) || 0));
                    const stockName = this._getText(item.STOCKITEMNAME);

                    if (!stockName) return;

                    if (vTypeLower.includes('sales') || vTypeLower.includes('tax invoice')) {
                        // STOCK: Sales Outwards
                        if (!stockStats[stockName]) stockStats[stockName] = { qty: 0, revenue: 0, lastSaleDate: voucherDate, inwardQty: 0, outwardQty: 0, inwardVal: 0, outwardVal: 0 };
                        stockStats[stockName].outwardQty += qty;
                        stockStats[stockName].outwardVal += amt;
                        stockStats[stockName].revenue += amt;
                        if (voucherDate > stockStats[stockName].lastSaleDate) stockStats[stockName].lastSaleDate = voucherDate;

                    } else if (vTypeLower.includes('credit note')) {
                        // STOCK: Sales Return (Inwards)
                        if (!stockStats[stockName]) stockStats[stockName] = { qty: 0, revenue: 0, lastSaleDate: voucherDate, inwardQty: 0, outwardQty: 0, inwardVal: 0, outwardVal: 0 };
                        stockStats[stockName].inwardQty += qty;
                        stockStats[stockName].revenue -= amt;

                    } else if (vTypeLower.includes('purchase')) {
                        // STOCK: Purchase Inwards
                        if (!stockStats[stockName]) stockStats[stockName] = { qty: 0, revenue: 0, lastSaleDate: voucherDate, inwardQty: 0, outwardQty: 0, inwardVal: 0, outwardVal: 0 };
                        stockStats[stockName].inwardQty += qty;
                        stockStats[stockName].inwardVal += amt;

                    } else if (vTypeLower.includes('debit note')) {
                        // STOCK: Purchase Return (Outwards)
                        if (!stockStats[stockName]) stockStats[stockName] = { qty: 0, revenue: 0, lastSaleDate: voucherDate, inwardQty: 0, outwardQty: 0, inwardVal: 0, outwardVal: 0 };
                        stockStats[stockName].outwardQty += qty;
                    }
                });
            }

            // --- Ledger Entries ---
            let ledEntries = v['ALLLEDGERENTRIES.LIST'] || v['LEDGERENTRIES.LIST'];
            if (ledEntries && !Array.isArray(ledEntries)) ledEntries = [ledEntries];

            if (ledEntries) {
                ledEntries.forEach(entry => {
                    const ledgerName = this._getText(entry.LEDGERNAME);
                    const amount = parseFloat(this._getText(entry.AMOUNT) || 0);

                    transaction.ledgers.push({ name: ledgerName, amount });

                    if (masters.ledgers[ledgerName]) {
                        const rootGroup = masters.ledgers[ledgerName].rootGroup;
                        if (rootGroup === 'Sundry Debtors' || rootGroup === 'Sundry Creditors') {
                            if (!ledgerBalances[ledgerName]) {
                                ledgerBalances[ledgerName] = { balance: 0, billRefs: [], group: rootGroup, parent: masters.ledgers[ledgerName].parent };
                            }
                            ledgerBalances[ledgerName].balance += amount;

                            let bills = entry['BILLALLOCATIONS.LIST'];
                            if (bills && !Array.isArray(bills)) bills = [bills];

                            if (bills) {
                                bills.forEach(b => {
                                    ledgerBalances[ledgerName].billRefs.push({
                                        date: voucherDate,
                                        name: this._getText(b.NAME),
                                        amount: parseFloat(this._getText(b.AMOUNT) || 0),
                                        type: this._getText(b.BILLTYPE)
                                    });
                                });
                            }
                        }
                    }
                });
            }

            allTransactions.push(transaction);
        });

        return this._finalizeAnalysis(monthlyStats, stockStats, ledgerBalances, allTransactions, masters, today);
    }

    // Helper: Get text from XML element (handles {_: "val", $: {TYPE: "..."}} and plain strings)
    _getText(el) {
        if (el === null || el === undefined) return null;
        if (typeof el === 'string') return el;
        if (typeof el === 'number') return String(el);
        if (el._ !== undefined) return el._;  // xml2js typed element {_: value, $: {TYPE: ...}}
        if (el.$ && el.$.toString) return null; // attribute-only, no text
        return String(el);
    }

    _emptyAnalysis() {
        return {
            monthlyStats: {},
            debtors: [],
            creditors: [],
            stocks: [],
            transactions: [],
            ledgersList: []
        };
    }

    _finalizeAnalysis(monthlyStats, stockStats, ledgerBalances, allTransactions, masters, today) {
        const debtors = [];
        const creditors = [];

        Object.entries(ledgerBalances).forEach(([name, data]) => {
            const billMap = {};
            data.billRefs.forEach(ref => {
                if (!billMap[ref.name]) billMap[ref.name] = { amount: 0, date: ref.date };
                billMap[ref.name].amount += ref.amount;
                if (ref.type === 'New Ref') billMap[ref.name].date = ref.date;
            });

            const buckets = { days30: 0, days60: 0, days90: 0, daysOver90: 0 };
            const openBills = [];

            Object.entries(billMap).forEach(([billName, val]) => {
                if (Math.abs(val.amount) > 1) {
                    const days = differenceInDays(today, val.date);
                    if (days <= 30) buckets.days30 += Math.abs(val.amount);
                    else if (days <= 60) buckets.days60 += Math.abs(val.amount);
                    else if (days <= 90) buckets.days90 += Math.abs(val.amount);
                    else buckets.daysOver90 += Math.abs(val.amount);

                    const yyyy = val.date.getFullYear();
                    const mm = String(val.date.getMonth() + 1).padStart(2, '0');
                    const dd = String(val.date.getDate()).padStart(2, '0');
                    openBills.push({ name: billName, date: `${yyyy}${mm}${dd}`, amount: val.amount });
                }
            });

            const record = {
                name,
                parentGroup: data.parent,
                balance: Math.abs(data.balance),
                status: buckets.daysOver90 > 0 ? 'Non-Performing' : 'Performing',
                buckets,
                openBills: openBills.sort((a, b) => a.date.localeCompare(b.date))
            };

            if (data.group === 'Sundry Debtors') debtors.push(record);
            else creditors.push(record);
        });

        const stocks = Object.entries(stockStats).map(([name, stats]) => {
            const closingQty = stats.inwardQty - stats.outwardQty;
            const avgRate = stats.inwardQty > 0 ? (stats.inwardVal / stats.inwardQty) : 0;
            const closingValue = closingQty * avgRate;
            const daysSinceSale = differenceInDays(today, stats.lastSaleDate);
            let movement = 'Non-Moving';
            if (daysSinceSale <= 30) movement = 'Fast';
            else if (daysSinceSale <= 90) movement = 'Slow';

            return {
                name,
                inwardQty: stats.inwardQty, outwardQty: stats.outwardQty,
                closingQty, closingValue, lastSaleDate: stats.lastSaleDate,
                movement, revenue: stats.revenue, class: 'C'
            };
        });

        stocks.sort((a, b) => b.revenue - a.revenue);
        const totalRev = stocks.reduce((sum, s) => sum + s.revenue, 0);
        let cumRev = 0;
        stocks.forEach(s => {
            cumRev += s.revenue;
            const pct = (cumRev / totalRev) * 100;
            if (pct <= 70) s.class = 'A';
            else if (pct <= 90) s.class = 'B';
        });

        allTransactions.sort((a, b) => b.date.localeCompare(a.date));

        Logger.info(`Analysis: ${allTransactions.length} transactions, ${debtors.length} debtors, ${creditors.length} creditors, ${stocks.length} stock items.`);

        return {
            monthlyStats,
            debtors: debtors.sort((a, b) => b.balance - a.balance),
            creditors: creditors.sort((a, b) => b.balance - a.balance),
            stocks: stocks.sort((a, b) => b.revenue - a.revenue),
            transactions: allTransactions,
            ledgersList: Object.keys(masters.ledgers || {}).sort()
        };
    }

    async _saveData(masters, analysis) {
        let linemanConfig = CONFIG.LINEMEN[this.companyName] || [];
        if (linemanConfig === 'DEFAULT') linemanConfig = CONFIG.LINEMEN['DEFAULT'];

        const completeData = {
            meta: { companyName: this.companyName, lastUpdated: new Date().toISOString() },
            linemanConfig,
            analysis: { ...analysis, linemanConfig, ledgerOpenings: masters.ledgers }
        };

        const outputFile = path.join(this.outputDir, 'data.json');
        await fs.writeJson(outputFile, completeData);
        Logger.success(`Data saved to ${outputFile}`);
    }

    async _updateCompanyIndex() {
        const companiesFile = path.join(CONFIG.PATHS.OUTPUT_DATA, 'companies.json');
        let companies = [];
        try { if (fs.existsSync(companiesFile)) companies = await fs.readJson(companiesFile); } catch (e) { }
        companies = companies.filter(c => c.id !== this.companyName);
        companies.push({ id: this.companyName, name: this.companyName.replace(/_/g, ' '), lastUpdated: new Date().toISOString() });
        await fs.writeJson(companiesFile, companies, { spaces: 2 });
    }
}

module.exports = DataProcessor;
