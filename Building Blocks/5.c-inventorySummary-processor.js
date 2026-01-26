const fs = require('fs');
const xml2js = require('xml2js');
const path = require('path');

const INPUT_XML = path.join(__dirname, '5.b_new.xml');
const OUTPUT_JSON = path.join(__dirname, '5.d-inventorySummary-json-output.json');

async function processScript() {
    if (!fs.existsSync(INPUT_XML)) {
        console.error("Error: 5.b not found.");
        process.exit(1);
    }
    const xml = fs.readFileSync(INPUT_XML, 'utf8');
    const parser = new xml2js.Parser({ explicitArray: false });

    parser.parseString(xml, (err, result) => {
        if (err) throw err;

        // Structure: ENVELOPE.BODY.DATA.COLLECTION.STOCKITEM
        // If collection empty, STOCKITEM undefined.
        // If one item, object. If multiple, array.

        const collection = result.ENVELOPE?.BODY?.DATA?.COLLECTION;
        let items = collection?.STOCKITEM || [];
        if (!Array.isArray(items)) items = [items];

        let totalQty = 0;
        let totalVal = 0;

        // Helper to safe parse float
        const parseFloatSafe = (val) => {
            if (val === undefined || val === null || val === "") return 0.0;
            const strVal = typeof val === 'object' && val._ ? val._ : val;
            // Remove Tally units e.g. "100.00 pcs" -> "100.00"
            const cleanVal = String(strVal).replace(/[^0-9.-]/g, '');
            const parsed = parseFloat(cleanVal);
            return isNaN(parsed) ? 0.0 : parsed;
        };

        items.forEach(item => {
            const qty = parseFloatSafe(item.CLOSINGBALANCE);
            const val = parseFloatSafe(item.CLOSINGVALUE);

            // Tally logic:
            // Closing Balance usually positive string with unit.
            // Closing Value negative if Debit (asset). 

            totalQty += qty;
            totalVal += Math.abs(val);
        });

        // Round to 2 decimals
        totalQty = parseFloat(totalQty.toFixed(2));
        totalVal = parseFloat(totalVal.toFixed(2));

        const json = {
            totalStockQuantity: totalQty,
            totalStockValue: totalVal,
            itemCount: items.length
        };

        fs.writeFileSync(OUTPUT_JSON, JSON.stringify(json, null, 2));
        console.log("Generated 5.d:", JSON.stringify(json, null, 2));
    });
}
processScript();
