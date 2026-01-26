const fs = require('fs');
const xml2js = require('xml2js');
const path = require('path');

// File paths
const INPUT_XML_FILE = path.join(__dirname, '2.b-fetchAllVouchers-xml-output.xml');
const OUTPUT_JSON_FILE = path.join(__dirname, '2.d-fetchAllVouchers-json-output.json');
const STEP_1_OUTPUT = path.join(__dirname, '1.d-companyName-fromDate-toDate-voucherQty-json-output.json');

async function processAllVouchers() {
    try {
        console.log(`Reading 2.b (XML Output): ${path.basename(INPUT_XML_FILE)}`);

        if (!fs.existsSync(INPUT_XML_FILE)) {
            console.error("Error: Input file 2.b not found.");
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
                    console.log("No collection data found.");
                    saveJson([], 0, "No Data");
                    return;
                }

                let vouchers = data.ALLVOUCHERSCOLL || data.VOUCHER;

                if (!vouchers) {
                    saveJson([], 0, "No Vouchers Found");
                    return;
                }

                if (!Array.isArray(vouchers)) {
                    vouchers = [vouchers];
                }

                const voucherQty = vouchers.length;
                console.log(`Parsed ${voucherQty} vouchers.`);

                // Verify count against Step 1 if available
                if (fs.existsSync(STEP_1_OUTPUT)) {
                    const step1Data = JSON.parse(fs.readFileSync(STEP_1_OUTPUT, 'utf8'));
                    if (step1Data.voucherQty === voucherQty) {
                        console.log(`SUCCESS: Count matches Step 1 (${voucherQty}).`);
                    } else {
                        console.warn(`WARNING: Count mismatch! Step 1: ${step1Data.voucherQty}, Step 2: ${voucherQty}`);
                    }
                }

                // Transform Data
                const simplifiedVouchers = vouchers.map(v => ({
                    date: getText(v.DATE),
                    vchType: getText(v.VOUCHERTYPENAME),
                    vchNo: getText(v.VOUCHERNUMBER),
                    party: getText(v.PARTYLEDGERNAME),
                    amount: getText(v.AMOUNT)
                }));

                saveJson(simplifiedVouchers, voucherQty, "Success");

            } catch (e) {
                console.error("Processing Error:", e.message);
            }
        });

    } catch (error) {
        console.error("Error:", error.message);
    }
}

function getText(val) {
    if (!val) return "";
    if (typeof val === 'string') return val;
    if (val._) return val._;
    return "";
}

function saveJson(data, count, status) {
    const result = {
        status: status,
        totalCount: count,
        vouchers: data
    };

    fs.writeFileSync(OUTPUT_JSON_FILE, JSON.stringify(result, null, 2));
    console.log(`Saved 2.d (JSON Output): ${path.basename(OUTPUT_JSON_FILE)}`);
}

processAllVouchers();
