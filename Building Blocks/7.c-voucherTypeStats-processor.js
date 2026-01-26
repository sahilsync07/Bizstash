const fs = require('fs');
const xml2js = require('xml2js');
const path = require('path');

const INPUT_XML = path.join(__dirname, '7.b_new.xml');
const OUTPUT_JSON = path.join(__dirname, '7.d-voucherTypeStats-json-output.json');

async function processScript() {
    if (!fs.existsSync(INPUT_XML)) {
        console.error("Error: 7.b not found.");
        process.exit(1);
    }
    const xml = fs.readFileSync(INPUT_XML, 'utf8');
    const parser = new xml2js.Parser({ explicitArray: false });

    parser.parseString(xml, (err, result) => {
        if (err) throw err;

        // Structure: ENVELOPE.BODY.DATA.COLLECTION.VOUCHER
        const collection = result.ENVELOPE?.BODY?.DATA?.COLLECTION;
        let vouchers = collection?.VOUCHER || [];
        if (!Array.isArray(vouchers)) vouchers = [vouchers];

        const stats = {};
        let totalCount = 0;

        // Iterate all vouchers and count types
        vouchers.forEach(v => {
            const type = v.VOUCHERTYPENAME;
            if (type) {
                if (!stats[type]) stats[type] = 0;
                stats[type]++;
                totalCount++;
            }
        });

        const json = {
            voucherTypeCounts: stats,
            totalVouchers: totalCount
        };

        fs.writeFileSync(OUTPUT_JSON, JSON.stringify(json, null, 2));
        console.log("Generated 7.d:", JSON.stringify(json, null, 2));
    });
}
processScript();
