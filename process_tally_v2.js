const fs = require('fs-extra');
const path = require('path');
const xml2js = require('xml2js');
const { parse, differenceInDays, parseISO, isWithinInterval } = require('date-fns');

const COMPANY_NAME = process.argv[2] || 'default_company';
const XML_DIR = path.join(__dirname, 'tally_data', 'xml');
const OUTPUT_DIR = path.join(__dirname, 'dashboard', 'public', 'data', COMPANY_NAME);

fs.ensureDirSync(OUTPUT_DIR);

const parser = new xml2js.Parser({ explicitArray: false });

async function parseMasters() {
    const mastersFile = path.join(XML_DIR, 'masters', 'masters.xml');
    if (!fs.existsSync(mastersFile)) return { ledgers: {}, groups: {} };

    const data = await fs.readFile(mastersFile);
    const result = await parser.parseStringPromise(data);

    const messages = result?.ENVELOPE?.BODY?.IMPORTDATA?.REQUESTDATA?.TALLYMESSAGE || [];
    const msgArray = Array.isArray(messages) ? messages : [messages];

    const ledgers = {};
    const groups = {};

    msgArray.forEach(msg => {
        if (msg.LEDGER) {
            ledgers[msg.LEDGER.$.NAME] = {
                name: msg.LEDGER.$.NAME,
                parent: msg.LEDGER.PARENT,
                openingBalance: parseFloat(msg.LEDGER.OPENINGBALANCE || 0)
            };
        } else if (msg.GROUP) {
            groups[msg.GROUP.$.NAME] = {
                name: msg.GROUP.$.NAME,
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

    return { ledgers, groups };
}

async function parseVouchersAndAnalyze(masters) {
    const vouchersDir = path.join(XML_DIR, 'vouchers');
    await fs.ensureDir(vouchersDir); // Ensure directory exists to prevent ENOENT
    const files = await fs.readdir(vouchersDir);
    const voucherXmls = files.filter(f => f.endsWith('.xml'));

    const monthlyStats = {};
    const stockStats = {};
    const ledgerBalances = {};

    // Pre-fill ledgerBalances with all Debtors/Creditors from masters to ensure those with no transactions are included
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

    // Detailed Transactions for Ledger View
    // Structure: items: [ { date, ledgers: [ { name, amount } ], type, number } ]
    // This allows re-constructing the view.
    // To save space, we might only store what's needed.
    const allTransactions = [];

    const today = new Date();

    for (const file of voucherXmls) {
        const content = await fs.readFile(path.join(vouchersDir, file));
        try {
            const result = await parser.parseStringPromise(content);
            const messages = result?.ENVELOPE?.BODY?.IMPORTDATA?.REQUESTDATA?.TALLYMESSAGE || [];
            const msgArray = Array.isArray(messages) ? messages : [messages];

            msgArray.forEach(msg => {
                if (!msg.VOUCHER) return;
                const v = msg.VOUCHER;
                const dateStr = v.DATE;
                const month = dateStr.substring(0, 6);
                const voucherDate = parse(dateStr, 'yyyyMMdd', new Date()); // Date Object

                // Transaction Record
                const transaction = {
                    date: dateStr, // YYYYMMDD
                    type: v.VOUCHERTYPENAME,
                    number: v.VOUCHERNUMBER,
                    guid: v.GUID,
                    ledgers: []
                };

                // --- Invoice/Inventory totals ---
                const invEntries = v['ALLINVENTORYENTRIES.LIST'] || v['INVENTORYENTRIES.LIST'];
                if (invEntries) {
                    const entries = Array.isArray(invEntries) ? invEntries : [invEntries];
                    // Stock Stats logic remains for Dashboard
                    entries.forEach(item => {
                        const amt = Math.abs(parseFloat(item.AMOUNT || 0));

                        let qty = 0;
                        const qtyRaw = item.BILLEDQTY || '';
                        // Try standard parsing
                        qty = parseFloat(qtyRaw);

                        // If NaN, try regex extraction
                        if (isNaN(qty) && qtyRaw) {
                            const match = qtyRaw.match(/[\d\.]+/);
                            if (match) qty = parseFloat(match[0]);
                        }
                        if (isNaN(qty)) qty = 0;
                        qty = Math.abs(qty);



                        const vType = v.VOUCHERTYPENAME.toLowerCase();

                        // FIX: Added 'tax invoice' to catch Sales vouchers that are renamed
                        if (vType.includes('sales') || vType.includes('tax invoice') || vType.includes('delivery note')) {
                            if (!monthlyStats[month]) monthlyStats[month] = { sales: 0, purchase: 0 };
                            monthlyStats[month].sales += amt;

                            // Outward
                            if (!stockStats[item.STOCKITEMNAME]) stockStats[item.STOCKITEMNAME] = { qty: 0, revenue: 0, lastSaleDate: voucherDate, inwardQty: 0, inwardVal: 0, outwardQty: 0, outwardVal: 0 };
                            stockStats[item.STOCKITEMNAME].outwardQty += qty;
                            stockStats[item.STOCKITEMNAME].outwardVal += amt;
                            stockStats[item.STOCKITEMNAME].revenue += amt; // Keep for legacy compatibility if needed

                            if (voucherDate > stockStats[item.STOCKITEMNAME].lastSaleDate) {
                                stockStats[item.STOCKITEMNAME].lastSaleDate = voucherDate;
                            }

                        } else if (vType.includes('purchase') || vType.includes('receipt note')) {
                            if (!monthlyStats[month]) monthlyStats[month] = { sales: 0, purchase: 0 };
                            monthlyStats[month].purchase += amt;

                            // Inward
                            if (!stockStats[item.STOCKITEMNAME]) stockStats[item.STOCKITEMNAME] = { qty: 0, revenue: 0, lastSaleDate: voucherDate, inwardQty: 0, inwardVal: 0, outwardQty: 0, outwardVal: 0 };
                            stockStats[item.STOCKITEMNAME].inwardQty += qty;
                            stockStats[item.STOCKITEMNAME].inwardVal += amt;
                        }
                    });
                }

                // --- Ledger Entries ---
                const ledEntries = v['ALLLEDGERENTRIES.LIST'] || v['LEDGERENTRIES.LIST'];
                if (ledEntries) {
                    const entries = Array.isArray(ledEntries) ? ledEntries : [ledEntries];
                    entries.forEach(entry => {
                        const ledgerName = entry.LEDGERNAME;
                        const amount = parseFloat(entry.AMOUNT || 0); // Raw amount (+/-)

                        // Add to transaction record
                        transaction.ledgers.push({
                            name: ledgerName,
                            amount: amount
                        });

                        // Debtors/Creditors Logic
                        if (masters.ledgers[ledgerName]) {
                            const rootGroup = masters.ledgers[ledgerName].rootGroup;
                            if (rootGroup === 'Sundry Debtors' || rootGroup === 'Sundry Creditors') {
                                if (!ledgerBalances[ledgerName]) {
                                    ledgerBalances[ledgerName] = {
                                        balance: masters.ledgers[ledgerName].openingBalance || 0,
                                        billRefs: [],
                                        group: rootGroup,
                                        parent: masters.ledgers[ledgerName].parent // Capture immediate parent group (Line)
                                    };
                                }
                                ledgerBalances[ledgerName].balance += amount;

                                const bills = entry['BILLALLOCATIONS.LIST'];
                                if (bills) {
                                    const billList = Array.isArray(bills) ? bills : [bills];
                                    billList.forEach(b => {
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
            // ignore errors
        }
    }

    // --- Post-Process Debtors/Creditors ---
    const debtors = [];
    const creditors = [];

    Object.entries(ledgerBalances).forEach(([name, data]) => {
        // Aging Logic (Same as V2)
        const billMap = {};
        data.billRefs.forEach(ref => {
            if (!billMap[ref.name]) billMap[ref.name] = { amount: 0, date: ref.date };
            billMap[ref.name].amount += ref.amount;
            if (ref.type === 'New Ref') billMap[ref.name].date = ref.date;
        });

        const buckets = { days30: 0, days60: 0, days90: 0, daysOver90: 0 };
        Object.values(billMap).filter(v => Math.abs(v.amount) > 1).forEach(val => {
            const days = differenceInDays(today, val.date);
            if (days <= 30) buckets.days30 += Math.abs(val.amount);
            else if (days <= 60) buckets.days60 += Math.abs(val.amount);
            else if (days <= 90) buckets.days90 += Math.abs(val.amount);
            else buckets.daysOver90 += Math.abs(val.amount);
        });

        const openBills = [];
        Object.entries(billMap).forEach(([billName, val]) => {
            if (Math.abs(val.amount) > 1) { // Only showing bills with > 1 unit currency outstanding
                // val.date is a Date object. Convert to YYYYMMDD string for frontend.
                const yyyy = val.date.getFullYear();
                const mm = String(val.date.getMonth() + 1).padStart(2, '0');
                const dd = String(val.date.getDate()).padStart(2, '0');
                const dateString = `${yyyy}${mm}${dd}`;

                openBills.push({
                    name: billName,
                    date: dateString,
                    amount: val.amount
                });
            }
        });

        const record = {
            name,
            parentGroup: data.parent, // Expose Line/Area Group
            balance: Math.abs(data.balance),
            status: buckets.daysOver90 > 0 ? 'Non-Performing' : 'Performing',
            buckets,
            openBills: openBills.sort((a, b) => a.date.localeCompare(b.date)) // Replace raw billRefs with processed openBills
        };

        if (data.group === 'Sundry Debtors') debtors.push(record);
        else creditors.push(record);
    });

    const stocks = Object.entries(stockStats).map(([name, stats]) => {
        // Calculate Closing
        const closingQty = (stats.openingQty || 0) + stats.inwardQty - stats.outwardQty;
        // Simple Average Valuation
        const totalInwardVal = (stats.openingValue || 0) + stats.inwardVal;
        const totalInwardQty = (stats.openingQty || 0) + stats.inwardQty;
        const avgRate = totalInwardQty > 0 ? totalInwardVal / totalInwardQty : 0;
        const closingValue = closingQty * avgRate;

        // Movement Analysis
        const daysSinceSale = differenceInDays(today, stats.lastSaleDate);
        let movement = 'Non-Moving';
        if (daysSinceSale <= 30) movement = 'Fast';
        else if (daysSinceSale <= 90) movement = 'Slow';

        return {
            name,
            inwardQty: stats.inwardQty,
            outwardQty: stats.outwardQty,
            closingQty,
            closingValue,
            lastSaleDate: stats.lastSaleDate,
            movement,
            revenue: stats.revenue // for ABC sort
        };
    });

    // ABC Analysis
    stocks.sort((a, b) => b.revenue - a.revenue);
    const totalRevenue = stocks.reduce((acc, s) => acc + s.revenue, 0);
    let cumRevenue = 0;

    stocks.forEach(s => {
        cumRevenue += s.revenue;
        const percentage = (cumRevenue / totalRevenue) * 100;
        if (percentage <= 70) s.class = 'A';
        else if (percentage <= 90) s.class = 'B';
        else s.class = 'C';
    });

    // Sort transactions by date descending for UI
    allTransactions.sort((a, b) => b.date.localeCompare(a.date));

    return {
        monthlyStats,
        debtors: debtors.sort((a, b) => b.balance - a.balance),
        creditors: creditors.sort((a, b) => b.balance - a.balance),
        stocks: stocks.sort((a, b) => b.revenue - a.revenue),
        transactions: allTransactions,
        ledgersList: Object.keys(masters.ledgers).sort() // List of all ledger names for dropdown
    };
}

const LINEMEN_GLOBALS = {
    // Default / Shared Config (Admin Test PC & SBE Rayagada)
    'DEFAULT': [
        { name: "Sushant [Bobby]", lines: ["TIKIRI", "KASIPUR", "DURGI", "THERUBALI", "JK", "KALYAN SINGHPUR"], color: "bg-blue-500" },
        { name: "Dulamani Sahu", lines: ["BALIMELA", "CHITROKUNDA", "MALKANGIRI", "GUDARI", "GUNUPUR", "PARLAKHIMUNDI", "MUNIGUDA", "B.CTC", "PHULBAANI"], color: "bg-purple-500" },
        { name: "Aparna", lines: ["RAYAGADA", "LOCAL"], color: "bg-pink-500" },
        { name: "Raju", lines: ["JEYPUR", "PARVATHIPURAM", "KORAPUT", "SRIKAKULAM"], color: "bg-emerald-500" }
    ],
    'SBE_Rayagada': 'DEFAULT', // Uses Default
    'Admin_Test_PC': 'DEFAULT', // Uses Default

    // Placeholders for others - To be filled by User
    'SE_Koraput': [],
    'SF_SKLM': [],
    'SBEM_Malkangiri': []
};

async function main() {
    console.log("Analyzing Tally Data...");
    const masters = await parseMasters();
    const analysis = await parseVouchersAndAnalyze(masters);

    // Resolve Lineman Config
    let linemanConfig = LINEMEN_GLOBALS[COMPANY_NAME] || [];
    if (linemanConfig === 'DEFAULT') linemanConfig = LINEMEN_GLOBALS['DEFAULT'];

    const completeData = {
        meta: { companyName: COMPANY_NAME, lastUpdated: new Date().toISOString() },
        linemanConfig: linemanConfig, // Injected Config
        analysis: {
            ...analysis,
            ledgerOpenings: masters.ledgers // Pass full ledger objects to get open balance
        }
    };

    // --- Update Company Index (companies.json) ---
    const companiesFile = path.join(__dirname, 'dashboard', 'public', 'data', 'companies.json');
    let companies = [];
    try {
        if (fs.existsSync(companiesFile)) {
            companies = await fs.readJson(companiesFile);
        }
    } catch (e) {
        // ignore error, start fresh
    }

    // Remove existing entry for this company if exists
    companies = companies.filter(c => c.id !== COMPANY_NAME);

    // Add updated entry
    companies.push({
        id: COMPANY_NAME,
        name: COMPANY_NAME.replace(/_/g, ' '), // Human readable name
        lastUpdated: new Date().toISOString()
    });

    await fs.writeJson(companiesFile, companies, { spaces: 2 });
    console.log(`Updated Company Index: ${companies.length} companies registered.`);

    // --- Save Company Data ---
    const outputFile = path.join(OUTPUT_DIR, 'data.json');
    // Using simple writeJson might fail with massive transactions array (e.g. 50MB+).
    // But for 2-3k vouchers it's fine.
    await fs.writeJson(outputFile, completeData, { spaces: 0 }); // Minify JSON
    console.log(`Data saved to ${outputFile}`);
}

if (require.main === module) {
    main();
}

module.exports = { processData: main };
