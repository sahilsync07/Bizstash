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
        // const profitLoss = await this._parseProfitLoss(); // Deprecated
        const analysis = await this._parseVouchers(masters);
        // analysis.profitLoss = profitLoss; // Deprecated

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
            let name = g.$?.NAME || this._getText(g.NAME);
            if (name) {
                name = name.trim();
                groups[name] = {
                    name,
                    parent: this._getText(g.PARENT) // _getText trims now
                };
            }
        });

        // 2. Parse Ledgers
        await parseCollection(ledgersFile, 'LEDGER', (l) => {
            let name = l.$?.NAME || this._getText(l.NAME);
            if (name) {
                name = name.trim();
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
            const cleanName = groupName.trim().replace(/[^\x20-\x7E]/g, '');
            const lowerName = cleanName.toLowerCase();

            // Stop at Standard P&L/Balance Sheet Root Groups (and common Tally typos)
            const roots = [
                'sundry debtors', 'sundry creditors',
                'sales accounts', 'purchase accounts', 'purchase acounts', 'sales acounts',
                'direct expenses', 'indirect expenses',
                'direct incomes', 'indirect incomes',
                'bank accounts', 'cash-in-hand', 'bank od a/c',
                'duties & taxes', 'provisions', 'fixed assets', 'current assets', 'current liabilities',
                'investments', 'loans & advances (asset)', 'loans (liability)', 'suspense a/c'
            ];

            // Find the canonical name from the list (if it matches)
            const canonicalRoots = {
                'sundry debtors': 'Sundry Debtors', 'sundry creditors': 'Sundry Creditors',
                'sales accounts': 'Sales Accounts', 'purchase accounts': 'Purchase Accounts',
                'purchase acounts': 'Purchase Accounts', 'sales acounts': 'Sales Accounts',
                'direct expenses': 'Direct Expenses', 'indirect expenses': 'Indirect Expenses',
                'direct incomes': 'Direct Incomes', 'indirect incomes': 'Indirect Incomes',
                'bank accounts': 'Bank Accounts', 'cash-in-hand': 'Cash-in-Hand', 'bank od a/c': 'Bank OD A/c',
                'duties & taxes': 'Duties & Taxes', 'provisions': 'Provisions', 'fixed assets': 'Fixed Assets',
                'current assets': 'Current Assets', 'current liabilities': 'Current Liabilities',
                'investments': 'Investments', 'loans & advances (asset)': 'Loans & Advances (Asset)',
                'loans (liability)': 'Loans (Liability)', 'suspense a/c': 'Suspense A/c'
            };

            if (canonicalRoots[lowerName]) return canonicalRoots[lowerName];

            const groupObj = groups[cleanName];
            if (!groupObj) return cleanName;

            let parent = groupObj.parent;
            if (parent && typeof parent !== 'string') parent = String(parent);
            if (parent) parent = parent.trim();

            // Stop if parent is missing, empty, or Primary
            if (!parent || parent === '' || parent.toLowerCase() === 'primary') return cleanName;
            return findRootGroup(parent);
        };

        Object.values(ledgers).forEach(l => {
            l.rootGroup = findRootGroup(l.parent);
        });

        Logger.info(`Parsed ${Object.keys(ledgers).length} Ledgers, ${Object.keys(groups).length} Groups.`);
        return { groups, ledgers };
    }

    // --- PROFIT & LOSS PARSER ---
    async _parseProfitLoss() {
        const plFile = path.join(this.mastersDir, 'profit_loss.xml');
        if (!fs.existsSync(plFile)) return { grossProfit: 0, netProfit: 0 };

        try {
            const xmlData = await fs.readFile(plFile, 'utf8');
            const parser = new xml2js.Parser({ explicitArray: false });
            const result = await parser.parseStringPromise(xmlData);

            let gp = 0, np = 0;

            // Recursive traversal to find key figures
            const traverse = (obj) => {
                if (!obj || typeof obj !== 'object') return;

                // key check
                if (obj.DSPACCNAME) {
                    const name = typeof obj.DSPACCNAME === 'string' ? obj.DSPACCNAME : obj.DSPACCNAME._;
                    const amt = obj.PLAMT ? (typeof obj.PLAMT === 'string' ? obj.PLAMT : obj.PLAMT._) : 0;

                    if (name === 'Gross Profit') gp = parseFloat(amt || 0);
                    if (name === 'Nett Profit' || name === 'Net Profit') np = parseFloat(amt || 0);
                }

                Object.values(obj).forEach(val => {
                    if (Array.isArray(val)) val.forEach(traverse);
                    else traverse(val);
                });
            };

            traverse(result);
            // Tally returns absolute values usually, but Credits might be negative. P&L amounts are usually positive in report view?
            // Actually Gross Profit is Credit side -> Negative?
            // We take logical value.
            return { grossProfit: Math.abs(gp), netProfit: Math.abs(np) };

        } catch (e) {
            Logger.error('Failed to parse Profit & Loss', e);
            return { grossProfit: 0, netProfit: 0 };
        }
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
        const groupTotals = {}; // Accumulate Group Totals for P&L
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
            if (this._getText(v.ISCANCELLED) === 'Yes' || this._getText(v.ISOPTIONAL) === 'Yes') return;

            // XML Collection format: DATE is in element or attribute
            const dateStr = this._getText(v.DATE); // YYYYMMDD
            if (!dateStr) return;

            const month = dateStr.substring(0, 6);
            const voucherDate = parse(dateStr, 'yyyyMMdd', new Date());
            const vType = (v.$.VCHTYPE || this._getText(v.VOUCHERTYPENAME) || this._getText(v.VOUCHERTYPE) || 'Unknown').trim(); // Check attribute first
            const vTypeLower = vType.toLowerCase(); // Lowercase for logic

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

            // --- Gather All Ledger Entries (including nested inventory allocations) ---
            let ledEntries = [];

            // 1. Direct Ledger Entries
            let directLedgers = v['ALLLEDGERENTRIES.LIST'] || v['LEDGERENTRIES.LIST'] || [];
            if (!Array.isArray(directLedgers)) directLedgers = [directLedgers];
            ledEntries.push(...directLedgers);

            // 2. Accounting Allocations from Inventory
            let invItems = v['ALLINVENTORYENTRIES.LIST'] || v['INVENTORYENTRIES.LIST'] || [];
            if (!Array.isArray(invItems)) invItems = [invItems];
            invItems.forEach(inv => {
                let allocations = inv['ACCOUNTINGALLOCATIONS.LIST'] || [];
                if (!Array.isArray(allocations)) allocations = [allocations];
                ledEntries.push(...allocations);
            });

            if (ledEntries.length > 0) {
                ledEntries.forEach(entry => {
                    const ledgerName = this._getText(entry.LEDGERNAME);
                    if (!ledgerName) return;
                    const amount = parseFloat(this._getText(entry.AMOUNT) || 0);

                    transaction.ledgers.push({ name: ledgerName, amount });

                    if (masters.ledgers[ledgerName]) {
                        let rootGroup = (masters.ledgers[ledgerName].rootGroup || 'Unknown').trim().replace(/[^\x20-\x7E]/g, '');

                        // Safety Fallback for P&L categorization based on ledger name
                        if (rootGroup === 'Primary' || rootGroup === 'Unknown') {
                            const lowerN = ledgerName.toLowerCase();
                            if (lowerN.includes('sales')) rootGroup = 'Sales Accounts';
                            else if (lowerN.includes('purchase')) rootGroup = 'Purchase Accounts';
                        }
                        // Map the specific typo
                        if (rootGroup === 'Purchase Acounts') rootGroup = 'Purchase Accounts';
                        if (rootGroup === 'Sales Acounts') rootGroup = 'Sales Accounts';

                        // Debug first 20 ledgers
                        if (!this.debugCount) this.debugCount = 0;
                        if (this.debugCount < 20) {
                            Logger.info(`L: ${ledgerName} | RG: '${rootGroup}' | P: '${masters.ledgers[ledgerName].parent}'`);
                            this.debugCount++;
                        }

                        // Accumulate for P&L (Global)
                        if (!groupTotals[rootGroup]) groupTotals[rootGroup] = 0;
                        groupTotals[rootGroup] += amount;

                        // Accumulate for P&L (Monthly)
                        if (!monthlyStats[month]) monthlyStats[month] = { sales: 0, purchase: 0, groupTotals: {} };
                        if (!monthlyStats[month].groupTotals) monthlyStats[month].groupTotals = {};
                        if (!monthlyStats[month].groupTotals[rootGroup]) monthlyStats[month].groupTotals[rootGroup] = 0;
                        monthlyStats[month].groupTotals[rootGroup] += amount;

                        if (rootGroup === 'Sundry Debtors' || rootGroup === 'Sundry Creditors') {
                            if (!ledgerBalances[ledgerName]) {
                                ledgerBalances[ledgerName] = { balance: 0, billRefs: [], group: rootGroup, parent: masters.ledgers[ledgerName].parent };
                            }
                            ledgerBalances[ledgerName].balance += amount;
                        }
                    }

                    let bills = entry['BILLALLOCATIONS.LIST'];
                    if (bills && !Array.isArray(bills)) bills = [bills];

                    if (bills && ledgerBalances[ledgerName]) {
                        bills.forEach(b => {
                            ledgerBalances[ledgerName].billRefs.push({
                                date: voucherDate,
                                amount: parseFloat(this._getText(b.AMOUNT) || 0),
                                type: this._getText(b.BILLTYPE),
                                name: this._getText(b.NAME)
                            });
                        });
                    }
                });
            }

            allTransactions.push(transaction);
        });

        return this._finalizeAnalysis(monthlyStats, stockStats, ledgerBalances, allTransactions, masters, today, groupTotals);
    }

    // Helper: Get text from XML element (handles {_: "val", $: {TYPE: "..."}} and plain strings)
    _getText(el) {
        if (el === null || el === undefined) return null;
        let str = '';
        if (typeof el === 'string') str = el;
        else if (typeof el === 'number') str = String(el);
        else if (el._ !== undefined) str = el._;
        else if (el.$ && el.$.toString) return null;
        else str = String(el);

        return str.trim().replace(/[^\x20-\x7E]/g, '');
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

    _finalizeAnalysis(monthlyStats, stockStats, ledgerBalances, allTransactions, masters, today, groupTotals) {
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

        // Calculate P&L (Gross Profit & Net Profit)
        Logger.info(`P&L Groups Found: ${Object.keys(groupTotals).join(', ')}`);

        const Sales = Math.abs(groupTotals['Sales Accounts'] || 0);
        const Purchase = Math.abs(groupTotals['Purchase Accounts'] || 0);
        const DirectExp = Math.abs(groupTotals['Direct Expenses'] || 0);
        const DirectInc = Math.abs(groupTotals['Direct Incomes'] || 0);
        const IndirectExp = Math.abs(groupTotals['Indirect Expenses'] || 0);
        const IndirectInc = Math.abs(groupTotals['Indirect Incomes'] || 0);

        // Gross Profit = Sales - Purchase - DirectExp + DirectInc
        const grossProfit = Sales - Purchase - DirectExp + DirectInc;

        // Net Profit = Gross Profit + IndirectInc - IndirectExp
        const netProfit = grossProfit + IndirectInc - IndirectExp;

        // Calculate Monthly P&L
        Object.keys(monthlyStats).forEach(month => {
            const m = monthlyStats[month];
            const g = m.groupTotals || {};

            const mSales = Math.abs(g['Sales Accounts'] || 0);
            const mPurchase = Math.abs(g['Purchase Accounts'] || 0);
            const mDirectExp = Math.abs(g['Direct Expenses'] || 0);
            const mDirectInc = Math.abs(g['Direct Incomes'] || 0);
            const mIndirectExp = Math.abs(g['Indirect Expenses'] || 0);
            const mIndirectInc = Math.abs(g['Indirect Incomes'] || 0);

            m.grossProfit = mSales - mPurchase - mDirectExp + mDirectInc;
            m.netProfit = m.grossProfit + mIndirectInc - mIndirectExp;

            // Back-fill sales/purchase if they were missed by the vchType logic but caught by groups
            if (m.sales === 0) m.sales = mSales;
            if (m.purchase === 0) m.purchase = mPurchase;

            m.details = {
                DirectExp: mDirectExp,
                DirectInc: mDirectInc,
                IndirectExp: mIndirectExp,
                IndirectInc: mIndirectInc
            };
            delete m.groupTotals; // Clean up
        });

        const profitLoss = {
            grossProfit,
            netProfit,
            sales: Sales,
            purchase: Purchase,
            details: { DirectExp, DirectInc, IndirectExp, IndirectInc }
        };

        return {
            monthlyStats,
            debtors: debtors.sort((a, b) => b.balance - a.balance),
            creditors: creditors.sort((a, b) => b.balance - a.balance),
            stocks: stocks.sort((a, b) => b.revenue - a.revenue),
            transactions: allTransactions,
            ledgersList: Object.keys(masters.ledgers || {}).sort(),
            profitLoss
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
