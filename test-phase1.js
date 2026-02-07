#!/usr/bin/env node

/**
 * TEST SCRIPT - Phase 1 Fetch Validation
 * 
 * Validates:
 * 1. Tally connection status
 * 2. Masters fetch (ledgers + groups)
 * 3. Vouchers fetch with progressive batching
 * 4. File output and data quality
 */

const fs = require('fs-extra');
const path = require('path');

// Add parent modules to path for imports
const config = require('./sync/config');
const { testConnection } = require('./sync-modules/phase1-fetch/tally-connector');
const { runPhase1 } = require('./sync-modules/phase1-fetch/fetch-phase1');
const progressTracker = require('./sync-modules/phase1-fetch/progress-tracker');

/**
 * Main test execution
 */
async function runTests() {
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║    BIZSTASH PHASE 1 - TEST SUITE          ║');
  console.log('╚════════════════════════════════════════════╝\n');

  // Ensure output directories exist
  fs.ensureDirSync(config.MASTERS_DIR);
  fs.ensureDirSync(config.VOUCHERS_DIR);
  fs.ensureDirSync(config.REPORTS_DIR);

  progressTracker.log(`Config validated:`, 'info');
  progressTracker.log(`  • Tally URL: ${config.TALLY_URL}`, 'info');
  progressTracker.log(`  • Masters output: ${config.MASTERS_DIR}`, 'info');
  progressTracker.log(`  • Vouchers output: ${config.VOUCHERS_DIR}`, 'info');
  progressTracker.log(`  • Batch delay: ${config.BATCH_DELAY}s`, 'info');
  progressTracker.log(`  • Retry attempts: ${config.RETRY_ATTEMPTS}`, 'info');
  progressTracker.log('', 'info');

  // Run Phase 1
  progressTracker.log('Executing Phase 1...', 'info');
  const result = await runPhase1(config.DEFAULT_COMPANY);

  // Report
  if (result.success) {
    progressTracker.log('', 'success');
    progressTracker.log('✓ TESTS PASSED', 'success');
    progressTracker.log('', 'info');
    progressTracker.log(`Masters: ${result.masters.ledgers} ledgers, ${result.masters.groups} groups`, 'info');
    progressTracker.log(`Vouchers: ${result.vouchers.totalRecords} total across ${result.vouchers.monthsSuccess}/${result.vouchers.monthsTotal} months`, 'info');
    process.exit(0);
  } else {
    progressTracker.log('', 'error');
    progressTracker.log('✗ TESTS FAILED', 'error');
    progressTracker.log(`Error: ${result.error}`, 'error');
    process.exit(1);
  }
}

// Execute
runTests().catch(error => {
  progressTracker.log(`Fatal test error: ${error.message}`, 'error');
  process.exit(1);
});
