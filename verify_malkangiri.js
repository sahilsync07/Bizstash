const fs = require('fs-extra');
const path = require('path');
const xml2js = require('xml2js');
const TallyConnection = require('./sync/TallyConnection');

async function verify() {
    try {
        console.log('--- Verifying Data for SBEM_Malkangiri ---');
        const dataPath = path.join(__dirname, 'dashboard', 'public', 'data', 'SBEM_Malkangiri', 'data.json');

        if (!fs.existsSync(dataPath)) {
            console.error('Data file not found. Please run sync first.');
            process.exit(1);
        }

        const data = await fs.readJson(dataPath);
        const analysis = data.analysis;
        // Check for profitLoss
        if (analysis.profitLoss) {
            console.log('✅ Profit & Loss Data Found:', analysis.profitLoss);
        } else {
            console.log('❌ Profit & Loss Data MISSING in data.json');
        }

        const ledgersInFile = {};
        // Populate from debtors/creditors/stocks/etc? No, need flat list.
        // analysis.ledgersList is just names.
        // We need BALANCES from file.
        // analysis.debtors/creditors have balances.
        // What about Cash/Bank?
        // They might be in analysis.transactions? Or not exposed directly unless classified.
        // The dashboard mainly shows Debtors/Creditors.

        // However, the Ledger View (drill down) fetches data?
        // data.json contains transactions. We can compute balance?
        // Or did we save ledgerBalances in data.json?
        // DataProcessor _saveData saves `masters` and `analysis`.
        // analysis contains { monthlyStats, debtors, creditors, stocks, transactions, ledgersList, profitLoss }.
        // It does NOT contain ALL ledger balances explicitly unless in debtors/creditors.

        // So we can only verify Debtors/Creditors balances easily.
        // Or re-compute from transactions?

        // Let's verify Random Debtors/Creditors.

        const targets = [...analysis.debtors, ...analysis.creditors];
        if (targets.length === 0) {
            console.log('No Debtors/Creditors to verify.');
            return;
        }

        const samples = [];
        for (let i = 0; i < 5; i++) {
            const r = targets[Math.floor(Math.random() * targets.length)];
            if (!samples.find(s => s.name === r.name)) samples.push(r);
        }

        console.log(`\nVerifying ${samples.length} Random Ledgers (Debtors/Creditors):`);

        // Fetch Live Balance
        const tdl = `
        <ENVELOPE>
            <HEADER>
                <VERSION>1</VERSION>
                <TALLYREQUEST>Export Data</TALLYREQUEST>
                <TYPE>Collection</TYPE>
                <ID>VerifyColl</ID>
            </HEADER>
            <BODY>
                <DESC>
                    <STATICVARIABLES>
                        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
                    </STATICVARIABLES>
                    <TDL>
                        <TDLMESSAGE>
                            <COLLECTION NAME="VerifyColl">
                                <TYPE>Ledger</TYPE>
                                <FETCH>Name, ClosingBalance</FETCH>
                            </COLLECTION>
                        </TDLMESSAGE>
                    </TDL>
                </DESC>
            </BODY>
        </ENVELOPE>`;

        console.log('Fetching live Closing Balances from Tally...');
        const xml = await TallyConnection.send(tdl);

        const parser = new xml2js.Parser({ explicitArray: false });
        const result = await parser.parseStringPromise(xml);

        const ledgerList = result?.ENVELOPE?.BODY?.DATA?.COLLECTION?.LEDGER || [];
        const liveBalances = {};

        const items = Array.isArray(ledgerList) ? ledgerList : [ledgerList];
        items.forEach(l => {
            const name = l.$?.NAME || l.NAME; // Handle attribute or element
            // Tally XML: <LEDGER NAME="Info" ...> OR <LEDGER><NAME>Info</NAME>...
            // Usually <LEDGER NAME="..."> in collections if not explicit?
            // Wait, TdlBuilder.getLedgers used <FETCH>Name...</FETCH>.
            // Result is usually <LEDGER><NAME>...</NAME><CLOSINGBALANCE>...</CLOSINGBALANCE>...

            let n = l.NAME;
            if (l.$ && l.$.NAME) n = l.$.NAME;
            if (n && typeof n === 'object') n = n._;

            const b = l.CLOSINGBALANCE && typeof l.CLOSINGBALANCE === 'object' ? l.CLOSINGBALANCE._ : l.CLOSINGBALANCE;
            if (n) {
                const cleanN = String(n).trim().replace(/[^\x20-\x7E]/g, '');
                liveBalances[cleanN] = parseFloat(b || 0);
            }
        });

        console.log(`Live Data Fetched (${Object.keys(liveBalances).length} ledgers). Comparing...\n`);
        if (Object.keys(liveBalances).length > 0) console.log('Samples of Live Keys:', Object.keys(liveBalances).slice(0, 10));

        samples.forEach(s => {
            const live = liveBalances[s.name];
            // Tally Closing Balance: Credit is negative? Or distinct?
            // In Dashboard, we stored ABSOLUTE value for Debtors/Creditors.
            // Sundry Debtors: Debit Balance (Positive).
            // Sundry Creditors: Credit Balance (Negative).
            // But we stored Math.abs().

            // We need to compare Math.abs(live) vs s.balance.

            const liveAbs = Math.abs(live || 0);
            const fileAbs = s.balance;
            const diff = Math.abs(liveAbs - fileAbs);

            const status = diff < 1 ? '✅ MATCH' : '❌ MISMATCH'; // Tolerate rounding
            console.log(`${status} | ${s.name.padEnd(30)} | Dashboard: ${fileAbs.toFixed(2).padStart(12)} | Tally: ${liveAbs.toFixed(2).padStart(12)} | Diff: ${diff.toFixed(2)}`);
        });

    } catch (e) {
        console.error('Verification Failed:', e);
    }
}

verify();
