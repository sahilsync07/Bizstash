#!/usr/bin/env node

/**
 * BIZSTASH PHASE 4 TEST
 * Generate final output reports and exports
 * 
 * Input: Analysis data from Phase 3
 * Output: CSV exports, PDF reports, HTML dashboards
 */

const path = require('path');
const fs = require('fs-extra');
const { runPhase4 } = require('./sync-modules/phase4-output');

async function main() {
  console.log(`
╔════════════════════════════════════════════╗
║    BIZSTASH PHASE 4 - TEST SUITE          ║
╚════════════════════════════════════════════╝
`);

  try {
    // Verify Phase 3 data exists
    const analysisDir = path.join(process.cwd(), 'tally_data/analysis');

    if (!fs.existsSync(analysisDir)) {
      throw new Error(`Analysis directory not found.\nRun Phase 3 first with: node test-phase3.js`);
    }

    const files = fs.readdirSync(analysisDir).filter(f => f.endsWith('.json'));

    console.log('Input Data:');
    console.log(`  • Analysis files: ${files.length} JSON files`);
    console.log(`  • Files: ${files.join(', ')}`);
    console.log('');

    // Execute Phase 4
    console.log('Executing Phase 4...\n');
    const result = await runPhase4();

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
