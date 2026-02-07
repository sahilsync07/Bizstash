#!/usr/bin/env node

/**
 * BIZSTASH PHASE 2 TEST
 * Parse XML data from Phase 1 and convert to JSON
 * 
 * Input: Masters + Vouchers XML files from tally_data/xml/
 * Output: Parsed JSON with proper structure in tally_data/json/
 */

const path = require('path');
const fs = require('fs-extra');
const { runPhase2 } = require('./sync-modules/phase2-parse');

async function main() {
  console.log(`
╔════════════════════════════════════════════╗
║    BIZSTASH PHASE 2 - TEST SUITE          ║
╚════════════════════════════════════════════╝
`);

  try {
    // Verify Phase 1 data exists
    const mastersPath = path.join(process.cwd(), 'tally_data/xml/masters/masters.xml');
    const vouchersDir = path.join(process.cwd(), 'tally_data/xml/vouchers');

    if (!fs.existsSync(mastersPath)) {
      throw new Error(`Masters file not found: ${mastersPath}\nRun Phase 1 first with: node test-phase1.js`);
    }

    if (!fs.existsSync(vouchersDir)) {
      throw new Error(`Vouchers directory not found: ${vouchersDir}\nRun Phase 1 first with: node test-phase1.js`);
    }

    const mastersStats = fs.statSync(mastersPath);
    const voucherFiles = fs.readdirSync(vouchersDir).filter(f => f.endsWith('.xml'));

    console.log('Input Data Validation:');
    console.log(`  • Masters file: ${(mastersStats.size / (1024 * 1024)).toFixed(1)} MB`);
    console.log(`  • Voucher files: ${voucherFiles.length} files`);
    console.log('');

    // Execute Phase 2
    console.log('Executing Phase 2...\n');
    const result = await runPhase2();

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
