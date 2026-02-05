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
        let companies = data?.COMPANY || [];
        if (!Array.isArray(companies)) companies = [companies];

        // Filter out empty entries if any
        companies = companies.filter(c => c && c.NAME);

        let selectedCompany = null;
        if (companies.length > 0) {
            // Default to the first one found
            selectedCompany = companies[0];
            // TODO: If logic requires matching a specific name, allow passing via args
        }

        const json = {
            companyName: selectedCompany ? selectedCompany.NAME : "Unknown",
            fromDate: selectedCompany ? selectedCompany.BOOKSFROM : null,
            toDate: selectedCompany ? selectedCompany.LASTVOUCHERDATE : null,
            voucherQty: selectedCompany ? parseInt(selectedCompany.VOUCHERCOUNT || '0') : 0
        };

        fs.writeFileSync(OUTPUT_JSON, JSON.stringify(json, null, 2));
        console.log("Generated 1.d:", JSON.stringify(json, null, 2));
    });
}
processScript();
