const fs = require('fs');
const xml2js = require('xml2js');
const path = require('path');

const INPUT_XML = path.join(__dirname, '3.b-mastersCounts-xml-output.xml');
const OUTPUT_JSON = path.join(__dirname, '3.d-mastersCounts-json-output.json');

async function processScript() {
    if (!fs.existsSync(INPUT_XML)) {
        console.error("Error: 3.b not found.");
        process.exit(1);
    }
    const xml = fs.readFileSync(INPUT_XML, 'utf8');
    const parser = new xml2js.Parser({ explicitArray: false });

    parser.parseString(xml, (err, result) => {
        if (err) throw err;

        // Navigate to the company object inside the collection
        // Structure based on Tally response: ENVELOPE.BODY.DATA.COLLECTION.COMPANY
        const collection = result.ENVELOPE?.BODY?.DATA?.COLLECTION;

        // The collection type is Company, so we look for COMPANY tag
        // If multiple companies are open, this might be an array, but we usually target the active one.
        // We'll assume the first one if array, or the object if single.
        let companyData = collection?.COMPANY;

        if (Array.isArray(companyData)) {
            companyData = companyData[0];
        }

        if (!companyData) {
            console.error("Error: No Company data found in XML response.");
            // Fallback to empty defaults if strict parsing fails but XML is valid
            companyData = {};
        }

        // Helper to safe parse int
        const parseIntSafe = (val) => {
            if (val === undefined || val === null) return 0;
            // Handle xml2js object format with attributes: { _: "66", $: { TYPE: "Number" } }
            const strVal = typeof val === 'object' && val._ ? val._ : val;
            const parsed = parseInt(strVal, 10);
            return isNaN(parsed) ? 0 : parsed;
        };

        const json = {
            counts: {
                groups: parseIntSafe(companyData.COUNTGROUPS),
                ledgers: parseIntSafe(companyData.COUNTLEDGERS),
                stockItems: parseIntSafe(companyData.COUNTSTOCKITEMS),
                units: parseIntSafe(companyData.COUNTUNITS),
                godowns: parseIntSafe(companyData.COUNTGODOWNS)
            }
        };

        fs.writeFileSync(OUTPUT_JSON, JSON.stringify(json, null, 2));
        console.log("Generated 3.d:", JSON.stringify(json, null, 2));
    });
}
processScript();
