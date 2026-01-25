const fs = require('fs-extra');
const path = require('path');
const xml2js = require('xml2js');

const XML_DIR = path.join(__dirname, 'tally_data', 'xml');
const JSON_DIR = path.join(__dirname, 'tally_data', 'json');
const MASTERS_FILE = path.join(XML_DIR, 'masters', 'masters.xml');
const VOUCHERS_DIR = path.join(XML_DIR, 'vouchers');

fs.ensureDirSync(JSON_DIR);

const parser = new xml2js.Parser({ explicitArray: false });

async function parseMasters() {
    if (!fs.existsSync(MASTERS_FILE)) {
        console.log('Masters file not found.');
        return {};
    }

    console.log('Reading Masters XML (this may take a moment)...');
    try {
        const data = await fs.readFile(MASTERS_FILE);
        console.log('Parsing Masters XML...');
        const result = await parser.parseStringPromise(data);

        const tallyMessages = result.ENVELOPE?.BODY?.IMPORTDATA?.REQUESTDATA?.TALLYMESSAGE;
        if (!tallyMessages) {
            console.log('No data found in Masters XML.');
            return {};
        }

        // TALLYMESSAGE can be an array or single object
        const messages = Array.isArray(tallyMessages) ? tallyMessages : [tallyMessages];

        const masters = {
            ledgers: [],
            groups: [],
            stockItems: [],
            units: []
        };

        messages.forEach(msg => {
            if (msg.LEDGER) {
                masters.ledgers.push({
                    name: msg.LEDGER.$.NAME,
                    parent: msg.LEDGER.PARENT,
                    guid: msg.LEDGER.GUID,
                    openingBalance: msg.LEDGER.OPENINGBALANCE
                });
            } else if (msg.GROUP) {
                masters.groups.push({
                    name: msg.GROUP.$.NAME,
                    parent: msg.GROUP.PARENT,
                    guid: msg.GROUP.GUID
                });
            } else if (msg.STOCKITEM) {
                masters.stockItems.push({
                    name: msg.STOCKITEM.$.NAME,
                    parent: msg.STOCKITEM.PARENT,
                    guid: msg.STOCKITEM.GUID,
                    uom: msg.STOCKITEM.BASEUNITS,
                    openingBalance: msg.STOCKITEM.OPENINGBALANCE,
                    openingValue: msg.STOCKITEM.OPENINGVALUE
                });
            } else if (msg.UNIT) {
                masters.units.push({
                    name: msg.UNIT.$.NAME,
                    guid: msg.UNIT.GUID
                });
            }
        });

        console.log(`Parsed ${masters.ledgers.length} Ledgers, ${masters.groups.length} Groups, ${masters.stockItems.length} StockItems.`);
        await fs.writeJson(path.join(JSON_DIR, 'masters.json'), masters, { spaces: 2 });
        return masters;

    } catch (err) {
        console.error('Error parsing Masters:', err);
        return {};
    }
}

async function parseVouchers(mastersCtx) {
    const files = await fs.readdir(VOUCHERS_DIR);
    const voucherFiles = files.filter(f => f.endsWith('.xml'));

    const allVouchers = [];

    console.log(`Found ${voucherFiles.length} voucher files.`);

    for (const file of voucherFiles) {
        console.log(`Processing ${file}...`);
        const content = await fs.readFile(path.join(VOUCHERS_DIR, file));
        try {
            const result = await parser.parseStringPromise(content);
            const tallyMessages = result.ENVELOPE?.BODY?.IMPORTDATA?.REQUESTDATA?.TALLYMESSAGE;

            if (!tallyMessages) continue;

            const messages = Array.isArray(tallyMessages) ? tallyMessages : [tallyMessages];

            messages.forEach(msg => {
                if (msg.VOUCHER) {
                    const v = msg.VOUCHER;

                    // Basic extraction needed for dashboard
                    const voucher = {
                        guid: v.GUID,
                        date: v.DATE,
                        type: v.VOUCHERTYPENAME,
                        number: v.VOUCHERNUMBER,
                        partyName: v.PARTYLEDGERNAME || v.PARTYNAME,
                        amount: 0, // Need to calculate effectively
                        ledgerEntries: [],
                        inventoryEntries: []
                    };

                    // Extract Ledger Entries (Amount calculation depends on these)
                    const ledgerEntries = v['ALLLEDGERENTRIES.LIST'] || v['LEDGERENTRIES.LIST'];
                    if (ledgerEntries) {
                        const entries = Array.isArray(ledgerEntries) ? ledgerEntries : [ledgerEntries];
                        voucher.ledgerEntries = entries.map(entry => ({
                            ledgerName: entry.LEDGERNAME,
                            amount: parseFloat(entry.AMOUNT || 0)
                        }));

                        // Heuristic for Voucher Amount: usually the first entry or max amount
                        // Or specifically for Sales, it's the Party Ledger amount.
                        // For simplicity, we might sum positive values or just store entries.
                    }

                    // Extract Inventory Entries
                    const invEntries = v['ALLINVENTORYENTRIES.LIST'] || v['INVENTORYENTRIES.LIST'];
                    if (invEntries) {
                        const entries = Array.isArray(invEntries) ? invEntries : [invEntries];
                        voucher.inventoryEntries = entries.map(entry => ({
                            itemName: entry.STOCKITEMNAME,
                            billedQty: parseFloat(entry.BILLEDQTY || 0),
                            amount: parseFloat(entry.AMOUNT || 0),
                            rate: entry.RATE
                        }));
                    }

                    allVouchers.push(voucher);
                }
            });

        } catch (e) {
            console.error(`Error parsing ${file}:`, e.message);
        }
    }

    // Deduplicate
    const uniqueVouchers = new Map();
    allVouchers.forEach(v => uniqueVouchers.set(v.guid, v));
    const finalVouchers = Array.from(uniqueVouchers.values());

    console.log(`Total Vouchers Parsed: ${finalVouchers.length}`);
    await fs.writeJson(path.join(JSON_DIR, 'vouchers.json'), finalVouchers, { spaces: 2 });
}

async function main() {
    const masters = await parseMasters();
    await parseVouchers(masters);
}

main();
