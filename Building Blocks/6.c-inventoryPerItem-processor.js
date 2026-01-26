const fs = require('fs');
const xml2js = require('xml2js');
const path = require('path');

const INPUT_XML = path.join(__dirname, '6.b-inventoryPerItem-xml-output.xml');
const OUTPUT_JSON = path.join(__dirname, '6.d-inventoryPerItem-json-output.json');

async function processScript() {
    if (!fs.existsSync(INPUT_XML)) {
        console.error("Error: 6.b not found.");
        process.exit(1);
    }
    const xml = fs.readFileSync(INPUT_XML, 'utf8');
    const parser = new xml2js.Parser({ explicitArray: false });

    parser.parseString(xml, (err, result) => {
        if (err) throw err;

        // Structure: ENVELOPE.BODY.DATA.COLLECTION.STOCKITEM
        const collection = result.ENVELOPE?.BODY?.DATA?.COLLECTION;
        let items = collection?.STOCKITEM || [];
        if (!Array.isArray(items)) items = [items];

        let outputItems = [];

        // Helper to safe parse float
        const parseFloatSafe = (val) => {
            if (val === undefined || val === null || val === "") return 0.0;
            const strVal = typeof val === 'object' && val._ ? val._ : val;
            const cleanVal = String(strVal).replace(/[^0-9.-]/g, '');
            const parsed = parseFloat(cleanVal);
            return isNaN(parsed) ? 0.0 : parsed;
        };

        // Helper to get raw string if needed (for unit preservation if desired, but requirements usually imply numeric match)
        // We will store both numeric and raw string for verification flexibility.

        items.forEach(item => {
            const name = item.NAME;
            // ClosingBalance is strict Quantity string (e.g. "100 pcs")
            const qtyStr = item.CLOSINGBALANCE;
            const valStr = item.CLOSINGVALUE;

            const qty = parseFloatSafe(qtyStr);
            const val = parseFloatSafe(valStr);

            outputItems.push({
                name: name,
                closingQuantity: qty,
                closingValue: Math.abs(val), // Value is often negative (Debit)
                rawQuantity: qtyStr,
                rawValue: valStr
            });
        });

        const json = {
            items: outputItems,
            totalCount: outputItems.length
        };

        fs.writeFileSync(OUTPUT_JSON, JSON.stringify(json, null, 2));
        console.log("Generated 6.d:", JSON.stringify(json, null, 2));
    });
}
processScript();
