
const fs = require('fs-extra');
const path = require('path');

async function inspect() {
    const dataPath = 'c:/Projects/Bizstash/dashboard/public/data/SBEM_Malkangiri/data.json';
    const data = await fs.readJson(dataPath);

    console.log('--- Ledger Groups ---');
    const ledgers = data.analysis.ledgerOpenings || {};
    const groupCounts = {};

    Object.entries(ledgers).forEach(([name, info]) => {
        const rg = info.rootGroup;
        groupCounts[rg] = (groupCounts[rg] || 0) + 1;
        if (rg === 'Sales Accounts' || rg === 'Purchase Accounts' || name.toLowerCase().includes('sales') || name.toLowerCase().includes('purchase')) {
            console.log(`L: ${name} | RG: ${rg} | P: ${info.parent}`);
        }
    });

    console.log('\n--- Group Counts ---');
    console.log(groupCounts);
}

inspect();
