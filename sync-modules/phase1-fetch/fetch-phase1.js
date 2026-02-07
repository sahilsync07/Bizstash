/**
 * PHASE 1 ORCHESTRATOR - Fetch all data from Tally
 * 
 * Coordinates:
 * 1. fetchMasters() - Get all ledgers/groups
 * 2. fetchVouchersByMonth() - Get all vouchers with 2.5s batch delays
 * 3. Error handling and progress reporting
 */

const config = require('../../sync/config');
const { fetchMasters } = require('./fetch-masters');
const { fetchVouchersByMonth } = require('./fetch-vouchers');
const { testConnection } = require('./tally-connector');
const progressTracker = require('./progress-tracker');

/**
 * Execute Phase 1: Fetch all data from Tally
 */
async function runPhase1(company = config.DEFAULT_COMPANY) {
  progressTracker.log('', 'info');
  progressTracker.log('╔════════════════════════════════════════════╗', 'info');
  progressTracker.log('║         BIZSTASH DATA SYNC - PHASE 1       ║', 'info');
  progressTracker.log('║              FETCH FROM TALLY              ║', 'info');
  progressTracker.log('╚════════════════════════════════════════════╝', 'info');
  progressTracker.log(`Company: ${company}`, 'info');
  progressTracker.log(`Tally URL: ${config.TALLY_URL}`, 'info');
  progressTracker.log(`Output: ${config.DATA_DIR}`, 'info');
  progressTracker.log('', 'info');

  progressTracker.startTimer('phase1_total');

  try {
    // Step 1: Test connection to Tally
    progressTracker.log('Step 1/3: Testing Tally connection...', 'info');
    const connectionTest = await testConnection();

    if (!connectionTest.success) {
      throw new Error(`Tally connection failed: ${connectionTest.error}`);
    }
    progressTracker.log(`✓ Tally connection OK (${connectionTest.responseTime}ms)`, 'success');
    progressTracker.log('', 'info');

    // Step 2: Fetch masters
    progressTracker.log('Step 2/3: Fetching masters...', 'info');
    const mastersResult = await fetchMasters(company);

    if (!mastersResult.success) {
      throw new Error(`Masters fetch failed: ${mastersResult.error}`);
    }
    progressTracker.log('', 'info');

    // Step 3: Fetch vouchers (progressive)
    progressTracker.log('Step 3/3: Fetching vouchers...', 'info');
    const vouchersResult = await fetchVouchersByMonth();

    if (!vouchersResult.success) {
      throw new Error(`Vouchers fetch failed: ${vouchersResult.error}`);
    }

    // Final report
    progressTracker.log('', 'info');
    progressTracker.log('╔════════════════════════════════════════════╗', 'success');
    progressTracker.log('║        PHASE 1 COMPLETED SUCCESSFULLY      ║', 'success');
    progressTracker.log('╚════════════════════════════════════════════╝', 'success');

    progressTracker.endTimer('phase1_total');

    // Generate report
    const report = progressTracker.generateReport(company, 'SUCCESS');
    progressTracker.log('', 'info');
    progressTracker.log('Full report saved to: ' + report.reportFile, 'info');

    return {
      success: true,
      masters: mastersResult,
      vouchers: vouchersResult,
      report
    };

  } catch (error) {
    progressTracker.log('', 'info');
    progressTracker.log('╔════════════════════════════════════════════╗', 'error');
    progressTracker.log('║         PHASE 1 FAILED - STOPPING          ║', 'error');
    progressTracker.log('╚════════════════════════════════════════════╝', 'error');
    progressTracker.log(`Error: ${error.message}`, 'error');

    progressTracker.endTimer('phase1_total');

    const report = progressTracker.generateReport(company, 'FAILED');
    progressTracker.log('', 'info');
    progressTracker.log('Report saved to: ' + report.reportFile, 'info');

    return {
      success: false,
      error: error.message,
      report
    };
  }
}

// Allow running directly via: node fetch-phase1.js
if (require.main === module) {
  runPhase1()
    .then(result => {
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = {
  runPhase1
};
