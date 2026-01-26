const fs = require('fs');
const xml2js = require('xml2js');
const path = require('path');

const STATS_JSON = path.join(__dirname, '1.d-companyName-fromDate-toDate-voucherQty-json-output.json');
const INPUT_XML = path.join(__dirname, '2.b-fetchAllVouchers-xml-output.xml');
const OUTPUT_JSON = path.join(__dirname, '2.d-fetchAllVouchers-json-output.json');

async function processScript() {
    // Check for 1.d first
    if (!fs.existsSync(STATS_JSON)) {
        console.error("Error: 1.d not found. Run 1.a first.");
        process.exit(1);
    }

    if (!fs.existsSync(INPUT_XML)) {
        console.error("Error: 2.b not found.");
        process.exit(1);
    }

    const stats = JSON.parse(fs.readFileSync(STATS_JSON, 'utf8'));
    const expectedQty = stats.voucherQty;

    const xml = fs.readFileSync(INPUT_XML, 'utf8');
    const parser = new xml2js.Parser({ explicitArray: false });

    parser.parseString(xml, (err, result) => {
        if (err) throw err;

        const data = result.ENVELOPE?.BODY?.DATA?.COLLECTION;
        let vouchers = data?.VOUCHERALLCOLL || data?.VOUCHER || [];
        if (!Array.isArray(vouchers)) vouchers = [vouchers];
        // Handle empty case
        if (vouchers.length === 1 && !vouchers[0].DATE) vouchers = [];

        const retrievedQty = vouchers.length;
        const match = retrievedQty === expectedQty;

        console.log(`[Verification] Expected: ${expectedQty}, Retrieved: ${retrievedQty}. Match: ${match}`);

        const output = {
            verification: {
                match: match,
                expectedQty: expectedQty,
                retrievedQty: retrievedQty
            },
            vouchers: vouchers // Save the raw list for inspection if needed
        };

        fs.writeFileSync(OUTPUT_JSON, JSON.stringify(output, null, 2));
        console.log("Generated 2.d");
    });
}
processScript();
