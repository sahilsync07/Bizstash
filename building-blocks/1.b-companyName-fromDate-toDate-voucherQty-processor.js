const fs = require('fs');
const xml2js = require('xml2js');
const path = require('path');

// File paths
const INPUT_XML_FILE = path.join(__dirname, '1.c-companyName-fromDate-toDate-voucherQty-xml-output.xml');
const OUTPUT_JSON_FILE = path.join(__dirname, '1.d-companyName-fromDate-toDate-voucherQty-json-output.json');

async function processCompanyStats() {
    try {
        console.log(`Reading input file: ${path.basename(INPUT_XML_FILE)}`);

        if (!fs.existsSync(INPUT_XML_FILE)) {
            console.error("Error: Input XML file (1.c) not found.");
            process.exit(1);
        }

        const xmlData = fs.readFileSync(INPUT_XML_FILE, 'utf8');

        // Parse XML
        const parser = new xml2js.Parser({ explicitArray: false });
        parser.parseString(xmlData, (err, result) => {
            if (err) {
                console.error("XML Parse Error:", err);
                return;
            }

            try {
                // Navigate to Collection
                const data = result.ENVELOPE?.BODY?.DATA?.COLLECTION;
                if (!data) {
                    console.log("No collection data found in XML response.");
                    saveJson(null, null, null, 0);
                    return;
                }

                let vouchers = data.VOUCHERSTATSCOLL || data.VOUCHER;

                if (!vouchers) {
                    saveJson(null, null, null, 0);
                    return;
                }

                if (!Array.isArray(vouchers)) {
                    vouchers = [vouchers];
                }

                const voucherQty = vouchers.length;
                let companyName = "Unknown";

                // Get company name from first voucher if available
                if (voucherQty > 0) {
                    const first = vouchers[0];
                    companyName = getText(
                        first.CMPNAME ||
                        first.COMPANYNAME ||
                        first.CMPINFO?.COMPANYNAME ||
                        first.cmpname ||
                        first.companyname
                    );
                }

                // Calculate Date Range
                const dates = vouchers
                    .map(v => getText(v.DATE || v.Date || v.date))
                    .filter(d => d && d.length === 8) // Ensure valid YYYYMMDD
                    .sort();

                if (dates.length === 0) {
                    saveJson(companyName, null, null, voucherQty);
                    return;
                }

                const fromDate = formatDate(dates[0]);
                const toDate = formatDate(dates[dates.length - 1]);

                saveJson(companyName, fromDate, toDate, voucherQty);

            } catch (e) {
                console.error("Processing Error:", e.message);
            }
        });

    } catch (error) {
        console.error("Error:", error.message);
    }
}

function getText(val) {
    if (!val) return null;
    if (typeof val === 'string') return val;
    if (val._) return val._;
    return null;
}

function formatDate(yyyymmdd) {
    // Convert YYYYMMDD to DD-MM-YYYY
    if (!yyyymmdd) return null;
    const y = yyyymmdd.substring(0, 4);
    const m = yyyymmdd.substring(4, 6);
    const d = yyyymmdd.substring(6, 8);
    return `${d}-${m}-${y}`;
}

function saveJson(name, from, to, qty) {
    const result = {
        companyName: name || "Unknown",
        fromDate: from || "N/A",
        toDate: to || "N/A",
        voucherQty: qty
    };

    fs.writeFileSync(OUTPUT_JSON_FILE, JSON.stringify(result, null, 2));
    console.log(`Saved JSON output to: ${path.basename(OUTPUT_JSON_FILE)}`);
    console.log(JSON.stringify(result, null, 2));
}

processCompanyStats();
