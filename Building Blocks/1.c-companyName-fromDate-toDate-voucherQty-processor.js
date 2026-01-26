const fs = require('fs');
const xml2js = require('xml2js');
const path = require('path');

const INPUT_XML = path.join(__dirname, '1.b-companyName-fromDate-toDate-voucherQty-xml-output.xml');
const OUTPUT_JSON = path.join(__dirname, '1.d-companyName-fromDate-toDate-voucherQty-json-output.json');

async function processScript() {
    if (!fs.existsSync(INPUT_XML)) {
        console.error("Error: 1.b not found.");
        process.exit(1);
    }
    const xml = fs.readFileSync(INPUT_XML, 'utf8');
    const parser = new xml2js.Parser({ explicitArray: false });

    parser.parseString(xml, (err, result) => {
        if (err) throw err;

        const data = result.ENVELOPE?.BODY?.DATA?.COLLECTION;
        let vouchers = data?.VOUCHERSTATSCOLL || data?.VOUCHER || [];
        if (!Array.isArray(vouchers)) vouchers = [vouchers];
        // If empty or just one empty object
        if (vouchers.length === 1 && !vouchers[0].DATE) vouchers = [];

        const qty = vouchers.length;
        let cmpName = "Unknown";
        if (qty > 0) {
            const v = vouchers[0];
            cmpName = v.CMPNAME || v.COMPANYNAME || v.CMPINFO?.COMPANYNAME || "Unknown";
        }

        const dates = vouchers
            .map(v => v.DATE || v.Date).filter(d => d).sort();

        const json = {
            companyName: cmpName,
            fromDate: dates[0] || null,
            toDate: dates[dates.length - 1] || null,
            voucherQty: qty
        };

        fs.writeFileSync(OUTPUT_JSON, JSON.stringify(json, null, 2));
        console.log("Generated 1.d:", JSON.stringify(json, null, 2));
    });
}
processScript();
