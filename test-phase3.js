#!/usr/bin/env node

/**
 * BIZSTASH PHASE 3 TEST
 * Analyze data and generate reports
 * 
 * Input: JSON data from Phase 2 (Masters + Vouchers)
 * Output: Analysis reports in tally_data/analysis/
 */

const path = require('path');
const fs = require('fs-extra');
const { runPhase3 } = require('./sync-modules/phase3-analyze');

async function main() {
  console.log(`
╔════════════════════════════════════════════╗
║    BIZSTASH PHASE 3 - TEST SUITE          ║
╚════════════════════════════════════════════╝
`);

  try {
    // Verify Phase 2 data exists
    const mastersJsonPath = path.join(process.cwd(), 'tally_data/json/masters.json');
    const vouchersJsonPath = path.join(process.cwd(), 'tally_data/json/vouchers.json');

    if (!fs.existsSync(mastersJsonPath) || !fs.existsSync(vouchersJsonPath)) {
      throw new Error(`JSON files not found.\nRun Phase 2 first with: node test-phase2.js`);
    }

    const mastersJson = await fs.readJson(mastersJsonPath);
    const vouchersJson = await fs.readJson(vouchersJsonPath);

    console.log('Input Data:');
    console.log(`  • Masters: ${mastersJson.data.ledgers.length} ledgers, ${mastersJson.data.groups.length} groups`);
    console.log(`  • Vouchers: ${vouchersJson.total} vouchers`);
    console.log('');

    // Execute Phase 3
    console.log('Executing Phase 3...\n');
    const result = await runPhase3();

    if (!result.success) {
      throw new Error(result.error);
    }

    console.log('\n✅ TESTS PASSED\n');
    process.exit(0);

  } catch (error) {
    console.error(`\n❌ ERROR: ${error.message}\n`);
    process.exit(1);
  }
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
