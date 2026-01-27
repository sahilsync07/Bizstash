const fs = require('fs');
const path = require('path');
const { XMLParser } = require('fast-xml-parser');

const INPUT_XML = path.join(__dirname, '8.b-balanceSheet-xml-output.xml');
const OUTPUT_JSON = path.join(__dirname, '8.d-balanceSheet-json-output.json');

const run = () => {
    if (!fs.existsSync(INPUT_XML)) {
        console.error("Input XML not found");
        return;
    }

    const xmlData = fs.readFileSync(INPUT_XML, 'utf8');
    const parser = new XMLParser({
        ignoreAttributes: true,
        parseTagValue: true,
        isArray: (name) => {
            // Force these tags to be arrays for consistent iteration
            return ["DSPACCNAME", "DSPACCINFO"];
        }
    });

    const jsonObj = parser.parse(xmlData);

    // Trial Balance Structure (DSPACCNAME array and DSPACCINFO array)
    // We need to map Name -> Closing Balance

    const envelope = jsonObj.ENVELOPE || {};
    const dspNames = envelope.DSPACCNAME || [];
    const dspInfos = envelope.DSPACCINFO || [];

    const ledgerMap = {};

    // Safety check
    const count = Math.min(dspNames.length, dspInfos.length);

    for (let i = 0; i < count; i++) {
        const name = dspNames[i];
        const info = dspInfos[i];

        // Closing Balances: DSPCLDRAMT (Debit), DSPCLCRAMT (Credit)
        // Note: Field names might be nested like DSPCLDRAMT.DSPCLDRAMTA

        let val = 0;

        // Helper to extract numeric value from structure
        const extractVal = (field) => {
            if (!field) return 0;
            if (typeof field === 'number') return field;
            if (typeof field === 'string') return parseFloat(field) || 0;
            // Sometimes it's { DSPCLDRAMTA: -123 }
            if (field.DSPCLDRAMTA) return parseFloat(field.DSPCLDRAMTA) || 0;
            if (field.DSPCLCRAMTA) return parseFloat(field.DSPCLCRAMTA) || 0;
            return 0;
        };

        const dr = extractVal(info.DSPCLDRAMT);
        const cr = extractVal(info.DSPCLCRAMT);

        // Net Balance (Debit is usually positive Asset/Expense, Credit is negative Liability/Income)
        // But in Trial Balance export, they are often absolute values in respective fields.
        // Let's store net.

        // If Logic: 
        // Capital Account -> Liability -> Credit
        // Current Assets -> Asset -> Debit

        // We just need the raw value associated with the group name to verify against "1,000,000" etc.
        // Let's store the non-zero one, or net.

        const net = (dr !== 0) ? dr : (cr !== 0 ? cr : 0); // Simplification for now
        ledgerMap[name] = net;
    }

    // Prepare Output matching Schema
    // liabilities: Capital Account, Loans (Liability), Current Liabilities, Profit & Loss A/c
    // assets: Fixed Assets, Investments, Current Assets
    // diffInOpeningBalances calculation

    const getVal = (key) => ledgerMap[key] || 0;

    const liabilities = {
        "Capital Account": getVal("Capital Account"),
        "Loans (Liability)": getVal("Loans (Liability)"),
        "Current Liabilities": getVal("Current Liabilities"),
        "Profit & Loss A/c": getVal("Profit & Loss A/c")
    };

    const assets = {
        "Fixed Assets": getVal("Fixed Assets"),
        "Investments": getVal("Investments"),
        "Current Assets": getVal("Current Assets")
    };

    // Standard Diff calculation (Assets - Liabilities) or explicitly finding "Diff. in Opening Balances"
    const diff = getVal("Diff. in Opening Balances");

    const output = {
        liabilities,
        assets,
        diffInOpeningBalances: diff,
        calculatedDiff: diff * -1 // Just a placeholder check
    };

    fs.writeFileSync(OUTPUT_JSON, JSON.stringify(output, null, 2));
    console.log("Block 8 JSON Generated using fast-xml-parser");
    console.log("Capital:", liabilities["Capital Account"]);
};

run();
