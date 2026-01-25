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
    const files = await fs.readdir(vouchersDir);
    const voucherXmls = files.filter(f => f.endsWith('.xml'));

    const monthlyStats = {};
    const stockStats = {};
    const ledgerBalances = {};

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
                        const vType = v.VOUCHERTYPENAME.toLowerCase();

                        // FIX: Added 'tax invoice' to catch Sales vouchers that are renamed
                        if (vType.includes('sales') || vType.includes('tax invoice')) {
                            if (!monthlyStats[month]) monthlyStats[month] = { sales: 0, purchase: 0 };
                            monthlyStats[month].sales += amt;

                            if (!stockStats[item.STOCKITEMNAME]) stockStats[item.STOCKITEMNAME] = { qty: 0, revenue: 0, lastSaleDate: voucherDate };
                            stockStats[item.STOCKITEMNAME].qty += parseFloat(item.BILLEDQTY || 0);
                            stockStats[item.STOCKITEMNAME].revenue += amt;
                            if (voucherDate > stockStats[item.STOCKITEMNAME].lastSaleDate) stockStats[item.STOCKITEMNAME].lastSaleDate = voucherDate;
                        } else if (vType.includes('purchase')) {
                            if (!monthlyStats[month]) monthlyStats[month] = { sales: 0, purchase: 0 };
                            monthlyStats[month].purchase += amt;
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
                                        group: rootGroup
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

        const record = {
            name,
            balance: Math.abs(data.balance),
            status: buckets.daysOver90 > 0 ? 'Non-Performing' : 'Performing',
            buckets
        };

        if (data.group === 'Sundry Debtors') debtors.push(record);
        else creditors.push(record);
    });

    const stocks = Object.entries(stockStats).map(([name, stats]) => ({
        name,
        qtySold: stats.qty,
        revenue: stats.revenue,
        analysis: differenceInDays(today, stats.lastSaleDate) < 60 ? 'Fast Moving' : 'Slow Moving'
    }));

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

async function main() {
    console.log("Analyzing Tally Data...");
    const masters = await parseMasters();
    const analysis = await parseVouchersAndAnalyze(masters);

    const completeData = {
        meta: { companyName: COMPANY_NAME, lastUpdated: new Date().toISOString() },
        analysis: {
            ...analysis,
            ledgerOpenings: masters.ledgers // Pass full ledger objects to get open balance
        }
    };

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
