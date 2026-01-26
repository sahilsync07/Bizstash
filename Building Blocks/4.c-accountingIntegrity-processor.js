const fs = require('fs');
const xml2js = require('xml2js');
const path = require('path');

const TB_XML = path.join(__dirname, '4.b-accountingIntegrity-TB-xml-output.xml');
// Note: 4.a generates this. If testing manually, ensure it exists or use manual names. 
// We will look for standard names.
const PL_XML = path.join(__dirname, '4.b-accountingIntegrity-PL-xml-output.xml');
const OUTPUT_JSON = path.join(__dirname, '4.d-accountingIntegrity-json-output.json');

async function processScript() {
    if (!fs.existsSync(TB_XML)) {
        console.error(`Error: TB XML not found at ${TB_XML}`);
        // For manual debugging resilience, try manual filename if standard fails? 
        // No, strict rules. The runner must produce the standard name.
        process.exit(1);
    }

    // Helper to parse XML
    const parseXML = (xmlPath) => {
        if (!fs.existsSync(xmlPath)) return null;
        const xml = fs.readFileSync(xmlPath, 'utf8');
        return new Promise((resolve, reject) => {
            const parser = new xml2js.Parser({ explicitArray: false });
            parser.parseString(xml, (err, result) => {
                if (err) reject(err);
                else resolve(result);
            });
        });
    };

    // Helper to safe parse float
    const parseFloatSafe = (val) => {
        if (val === undefined || val === null || val === "") return 0.0;
        const strVal = typeof val === 'object' && val._ ? val._ : val;
        // Remove currency symbols, commas, or spaces
        const cleanVal = String(strVal).replace(/[^0-9.-]/g, '');
        const parsed = parseFloat(cleanVal);
        return isNaN(parsed) ? 0.0 : parsed;
    };

    try {
        const tbData = await parseXML(TB_XML);
        const plData = await parseXML(PL_XML);

        // 1. Calculate Total Debit/Credit from Trial Balance
        // Structure: ENVELOPE -> [DSPACCNAME, DSPACCINFO, ...]
        // xml2js might group similarly named tags into arrays.
        // Let's handle ENVELOPE.DSPACCINFO as array.

        let totalDebit = 0;
        let totalCredit = 0;

        if (tbData && tbData.ENVELOPE) {
            let accInfos = tbData.ENVELOPE.DSPACCINFO || [];
            if (!Array.isArray(accInfos)) accInfos = [accInfos];

            accInfos.forEach(info => {
                const dr = parseFloatSafe(info.DSPCLDRAMT?.DSPCLDRAMTA);
                const cr = parseFloatSafe(info.DSPCLCRAMT?.DSPCLCRAMTA);

                // Sum absolute values to get "Total Debit Side" and "Total Credit Side"
                totalDebit += Math.abs(dr);
                totalCredit += Math.abs(cr);
            });
        }

        // 2. Extract Profit & Loss Net Amount
        let plAmount = 0;
        if (plData && plData.ENVELOPE) {
            // Structure: ENVELOPE.BODY.DATA.LEDGER.CLOSINGBALANCE
            // Or ENVELOPE.BODY.DATA.COLLECTION... depending on request.
            // Our request was TYPE=Object, SUBTYPE=Ledger.
            // Response typically: ENVELOPE.BODY.DATA.LEDGER

            // Check direct Ledger object if mapped
            const ledger = plData.ENVELOPE.BODY?.DATA?.LEDGER;
            if (ledger) {
                plAmount = parseFloatSafe(ledger.CLOSINGBALANCE);
            } else {
                // Sometimes it wraps? Check root levels just in case
                // But strictly adhering to typical Tally response.
            }
        }

        const json = {
            totalDebit: parseFloat(totalDebit.toFixed(2)),
            totalCredit: parseFloat(totalCredit.toFixed(2)),
            plNetAmount: parseFloat(plAmount.toFixed(2)),
            diff: parseFloat((totalDebit - totalCredit).toFixed(2))
        };

        fs.writeFileSync(OUTPUT_JSON, JSON.stringify(json, null, 2));
        console.log("Generated 4.d:", JSON.stringify(json, null, 2));

    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
processScript();
