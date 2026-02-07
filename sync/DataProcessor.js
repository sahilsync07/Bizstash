const fs = require('fs-extra');
const path = require('path');
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

        this.baseDir = path.resolve(CONFIG.PATHS.ROOT, 'tally_data', relativePath); // renamed from xmlDir to baseDir
        this.mastersDir = path.join(this.baseDir, 'masters');
        this.vouchersDir = path.join(this.baseDir, 'vouchers');
        this.outputDir = path.join(CONFIG.PATHS.OUTPUT_DATA, companyName);
    }

    async process() {
        Logger.info(`Processing data for ${this.companyName} (V4 Logic)...`);
        await fs.ensureDir(this.outputDir);

        const masters = await this._parseMasters();
        const analysis = await this._parseVouchers(masters);

        await this._saveData(masters, analysis);
        await this._updateCompanyIndex();

        Logger.success('Data Processing Complete.');
    }

    async _parseMasters() {
        // V4: Try JSON first
        const jsonFile = path.join(this.mastersDir, 'masters.json');
        if (fs.existsSync(jsonFile)) {
            Logger.info('Loading Masters from JSON...');
            try {
                // Tally JSONEX Output for Masters is usually { ENVELOPE: { BODY: { IMPORTDATA: { REQUESTDATA: { TALLYMESSAGE: [...] } } } } }
                // OR if we saved raw string in fetcher, we parse it here.
                // In DataFetcher V4 we verified we saved Raw String.
                const rawStr = await fs.readFile(jsonFile, 'utf8');
                const rawObj = JSON.parse(rawStr);

                const msgs = rawObj?.ENVELOPE?.BODY?.IMPORTDATA?.REQUESTDATA?.TALLYMESSAGE || [];
                const msgArray = Array.isArray(msgs) ? msgs : [msgs];

                return this._buildMastersStructure(msgArray);

            } catch (e) {
                Logger.error("Failed to parse masters.json", e);
                return { ledgers: {}, groups: {} };
            }
        }

        // Fallback to XML (V3 Hybrid Mode)
        const xmlFile = path.join(this.mastersDir, 'masters.xml');
        if (fs.existsSync(xmlFile)) {
            Logger.info("Parsing Masters from XML (Hybrid Mode)...");
            const xmlData = await fs.readFile(xmlFile, 'utf8');
            const parser = new require('xml2js').Parser({ explicitArray: false });
            const result = await parser.parseStringPromise(xmlData);

            const messages = result?.ENVELOPE?.BODY?.IMPORTDATA?.REQUESTDATA?.TALLYMESSAGE || [];
            const msgArray = Array.isArray(messages) ? messages : [messages];
            return this._buildMastersStructure(msgArray);
        }
        return { ledgers: {}, groups: {} };
    }

    _buildMastersStructure(msgArray) {
        const ledgers = {};
        const groups = {};

        msgArray.forEach(msg => {
            if (msg.LEDGER) {
                // JSONEx structure matches XML tag names usually
                ledgers[msg.LEDGER.NAME] = {
                    name: msg.LEDGER.NAME,
                    parent: msg.LEDGER.PARENT,
                    openingBalance: parseFloat(msg.LEDGER.OPENINGBALANCE || 0)
                };
            } else if (msg.GROUP) {
                groups[msg.GROUP.NAME] = {
                    name: msg.GROUP.NAME,
                    parent: msg.GROUP.PARENT
                };
            }
        });

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

        Logger.info(`Parsed ${Object.keys(ledgers).length} Ledgers from JSON.`);
        return { ledgers, groups };
    }

    async _parseVouchers(masters) {
        if (!fs.existsSync(this.vouchersDir)) return {};

        const files = await fs.readdir(this.vouchersDir);
        // Look for JSON files (V4)
        const voucherFiles = files.filter(f => f.endsWith('.json') && f.startsWith('vouchers_'));
        Logger.info(`Found ${voucherFiles.length} JSON voucher modules.`);

        const monthlyStats = {};
        const stockStats = {};
        const ledgerBalances = {};
        const allTransactions = [];
        const today = new Date();

        // Init Balances
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

        for (const file of voucherFiles) {
            try {
                // V4 Files are pure arrays of Voucher Objects
                const vouchers = await fs.readJson(path.join(this.vouchersDir, file));

                vouchers.forEach(v => {
                    const dateStr = v.DATE; // YYYYMMDD
                    if (!dateStr) return;
                    const month = dateStr.substring(0, 6);
                    const voucherDate = parse(dateStr, 'yyyyMMdd', new Date());

                    const transaction = {
                        date: dateStr,
                        type: v.VOUCHERTYPENAME,
                        number: v.VOUCHERNUMBER,
                        guid: v.GUID,
                        ledgers: []
                    };

                    // Inventory
                    // JSONEx treats keys with dots differently sometimes? 
                    // Usually "ALLINVENTORYENTRIES.LIST" becomes "ALLINVENTORYENTRIES_LIST" or array
                    // Let's check typical JSONEx output.
                    // Tally JSON output usually Arrays are nested objects.

                    // Note: We need to handle Tally's erratic JSON key naming depending on export.
                    // Assuming standard keys for now.
                    let invEntries = v['ALLINVENTORYENTRIES.LIST'] || v['INVENTORYENTRIES.LIST'];
                    if (invEntries && !Array.isArray(invEntries)) invEntries = [invEntries];

                    if (invEntries) {
                        invEntries.forEach(item => {
                            const amt = Math.abs(parseFloat(item.AMOUNT || 0));
                            let qty = parseFloat(item.BILLEDQTY) || 0; // JSON is already number often? No Tally sends strings.

                            const vType = (v.VOUCHERTYPENAME || '').toLowerCase();

                            if (vType.includes('sales') || vType.includes('tax invoice')) {
                                if (!monthlyStats[month]) monthlyStats[month] = { sales: 0, purchase: 0 };
                                monthlyStats[month].sales += amt;

                                if (!stockStats[item.STOCKITEMNAME]) stockStats[item.STOCKITEMNAME] = { qty: 0, revenue: 0, lastSaleDate: voucherDate, inwardQty: 0, outwardQty: 0, inwardVal: 0, outwardVal: 0 };
                                stockStats[item.STOCKITEMNAME].outwardQty += Math.abs(qty);
                                stockStats[item.STOCKITEMNAME].outwardVal += amt;
                                stockStats[item.STOCKITEMNAME].revenue += amt;
                                if (voucherDate > stockStats[item.STOCKITEMNAME].lastSaleDate) stockStats[item.STOCKITEMNAME].lastSaleDate = voucherDate;

                            } else if (vType.includes('purchase')) {
                                if (!monthlyStats[month]) monthlyStats[month] = { sales: 0, purchase: 0 };
                                monthlyStats[month].purchase += amt;

                                if (!stockStats[item.STOCKITEMNAME]) stockStats[item.STOCKITEMNAME] = { qty: 0, revenue: 0, lastSaleDate: voucherDate, inwardQty: 0, outwardQty: 0, inwardVal: 0, outwardVal: 0 };
                                stockStats[item.STOCKITEMNAME].inwardQty += Math.abs(qty);
                                stockStats[item.STOCKITEMNAME].inwardVal += amt;
                            }
                        });
                    }

                    // Ledgers
                    let ledEntries = v['ALLLEDGERENTRIES.LIST'] || v['LEDGERENTRIES.LIST'];
                    if (ledEntries && !Array.isArray(ledEntries)) ledEntries = [ledEntries];

                    if (ledEntries) {
                        ledEntries.forEach(entry => {
                            const ledgerName = entry.LEDGERNAME;
                            const amount = parseFloat(entry.AMOUNT || 0);

                            transaction.ledgers.push({ name: ledgerName, amount });

                            if (masters.ledgers[ledgerName]) {
                                const rootGroup = masters.ledgers[ledgerName].rootGroup;
                                if (rootGroup === 'Sundry Debtors' || rootGroup === 'Sundry Creditors') {
                                    if (!ledgerBalances[ledgerName]) ledgerBalances[ledgerName] = { balance: 0, billRefs: [], group: rootGroup, parent: masters.ledgers[ledgerName].parent };
                                    ledgerBalances[ledgerName].balance += amount;

                                    let bills = entry['BILLALLOCATIONS.LIST'];
                                    if (bills && !Array.isArray(bills)) bills = [bills];

                                    if (bills) {
                                        bills.forEach(b => {
                                            ledgerBalances[ledgerName].billRefs.push({
                                                date: voucherDate,
                                                name: b.NAME,
                                                amount: parseFloat(b.AMOUNT || 0),
                                                type: b.BILLTYPE
                                            });
                                        });
                                    }
                                }
                            }
                        });
                    }
                    allTransactions.push(transaction);
                });

            } catch (e) {
                Logger.error(`Skipping corrupt JSON ${file}`, e);
            }
        }

        return this._finalizeAnalysis(monthlyStats, stockStats, ledgerBalances, allTransactions, masters, today);
    }

    // _finalizeAnalysis and _saveData remain same as V3 (Shared Logic)
    // DUPLICATED HERE FOR NOW TO KEEP FILE SELF-CONTAINED or we can extend V3 class?
    // Let's copy-paste existing logic to be safe and explicit.

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
            analysis: { ...analysis, ledgerOpenings: masters.ledgers }
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
