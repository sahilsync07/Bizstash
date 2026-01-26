const fs = require('fs');
const xml2js = require('xml2js');
const path = require('path');

const TB_XML = path.join(__dirname, '4.b-accountingIntegrity-TB-xml-output.xml');
const OUTPUT_JSON = path.join(__dirname, '4.d-accountingIntegrity-json-output.json');
const LOG_FILE = path.join(__dirname, '4.c.log');

async function processScript() {
    const log = (msg) => fs.appendFileSync(LOG_FILE, msg + '\n');
    fs.writeFileSync(LOG_FILE, "Starting 4.c Processor\n");

    if (!fs.existsSync(TB_XML)) {
        log(`Error: TB XML not found at ${TB_XML}`);
        process.exit(1);
    }

    // Helper to parse XML
    const parseXML = (xmlPath) => {
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
        const cleanVal = String(strVal).replace(/[^0-9.-]/g, '');
        const parsed = parseFloat(cleanVal);
        return isNaN(parsed) ? 0.0 : parsed;
    };

    try {
        const tbData = await parseXML(TB_XML);

        let totalDebit = 0;
        let totalCredit = 0;
        let plAmount = 0;

        if (tbData && tbData.ENVELOPE) {
            const envelope = tbData.ENVELOPE;

            let names = envelope.DSPACCNAME || [];
            let infos = envelope.DSPACCINFO || [];

            if (!Array.isArray(names)) names = [names];
            if (!Array.isArray(infos)) infos = [infos];

            log(`Found ${names.length} names and ${infos.length} infos.`);

            for (let i = 0; i < names.length; i++) {
                const nameObj = names[i];
                const infoObj = infos[i];

                if (!nameObj || !infoObj) continue;

                // xml2js auto-decodes &amp; -> &
                const accountName = nameObj.DSPDISPNAME;
                const dr = parseFloatSafe(infoObj.DSPCLDRAMT?.DSPCLDRAMTA);
                const cr = parseFloatSafe(infoObj.DSPCLCRAMT?.DSPCLCRAMTA);

                log(`[${i}] Name: "${accountName}" | Dr: ${dr} | Cr: ${cr}`);

                totalDebit += Math.abs(dr);
                totalCredit += Math.abs(cr);

                // Case-insensitive flexible match
                if (accountName && /Profit.*Loss/i.test(accountName)) {
                    log(`>>> MATCHED P&L: "${accountName}"`);
                    if (cr > 0) plAmount = cr;
                    else if (dr < 0) plAmount = dr;
                    else plAmount = dr;
                }
            }
        }

        totalDebit = parseFloat(totalDebit.toFixed(2));
        totalCredit = parseFloat(totalCredit.toFixed(2));
        plAmount = parseFloat(plAmount.toFixed(2));
        const diff = parseFloat((totalDebit - totalCredit).toFixed(2));

        const json = {
            totalDebit: totalDebit,
            totalCredit: totalCredit,
            plNetAmount: Math.abs(plAmount),
            plType: plAmount > 0 ? "Profit" : "Loss",
            openingBalanceDifference: Math.abs(diff),
            isBalanced: Math.abs(diff) < 0.01,
            verificationNote: Math.abs(diff) > 0.01 ? "UNBALANCED: Contains Opening Balance Difference" : "BALANCED"
        };

        fs.writeFileSync(OUTPUT_JSON, JSON.stringify(json, null, 2));
        console.log("Generated 4.d:", JSON.stringify(json, null, 2));

    } catch (err) {
        log(`Error: ${err.message}`);
        console.error(err);
        process.exit(1);
    }
}
processScript();
