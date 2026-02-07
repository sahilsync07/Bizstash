/**
 * PHASE 3: ANALYZE DATA
 * 
 * Strategy:
 * 1. Generate trial balance from ledgers
 * 2. Analyze voucher statistics and patterns
 * 3. Validate data consistency
 * 4. Create ledger-wise transaction summaries
 */

const path = require('path');
const fs = require('fs-extra');
const config = require('../../sync/config');
const progressTracker = require('../phase1-fetch/progress-tracker');

/**
 * Load JSON data from Phase 2
 */
async function loadPhase2Data() {
  const mastersPath = path.join(config.DATA_DIR, 'json/masters.json');
  const vouchersPath = path.join(config.DATA_DIR, 'json/vouchers.json');

  const masters = await fs.readJson(mastersPath);
  const vouchers = await fs.readJson(vouchersPath);

  return { masters, vouchers };
}

/**
 * Generate trial balance
 */
function generateTrialBalance(masters) {
  const trialBalance = {
    assets: 0,
    liabilities: 0,
    equity: 0,
    income: 0,
    expenses: 0,
    ledgers: []
  };

  for (const ledger of masters.data.ledgers) {
    const category = categorizeAccount(ledger.parent || ledger.ledgerGroup);
    
    trialBalance.ledgers.push({
      name: ledger.name,
      parent: ledger.parent,
      group: ledger.ledgerGroup,
      balance: ledger.openingBalance,
      category
    });

    // Sum by category
    switch (category) {
      case 'Asset':
        trialBalance.assets += ledger.openingBalance;
        break;
      case 'Liability':
        trialBalance.liabilities += ledger.openingBalance;
        break;
      case 'Equity':
        trialBalance.equity += ledger.openingBalance;
        break;
      case 'Income':
        trialBalance.income += ledger.openingBalance;
        break;
      case 'Expense':
        trialBalance.expenses += ledger.openingBalance;
        break;
    }
  }

  return trialBalance;
}

/**
 * Categorize account by name/parent
 */
function categorizeAccount(name = '') {
  const nameUpper = (name || '').toUpperCase();

  if (nameUpper.includes('ASSET') || nameUpper.includes('BANK') || nameUpper.includes('CASH')) {
    return 'Asset';
  }
  if (nameUpper.includes('LIABILITY') || nameUpper.includes('PAYABLE')) {
    return 'Liability';
  }
  if (nameUpper.includes('EQUITY') || nameUpper.includes('CAPITAL')) {
    return 'Equity';
  }
  if (nameUpper.includes('INCOME') || nameUpper.includes('REVENUE') || nameUpper.includes('SALES')) {
    return 'Income';
  }
  if (nameUpper.includes('EXPENSE') || nameUpper.includes('COST')) {
    return 'Expense';
  }

  return 'Other';
}

/**
 * Analyze voucher statistics
 */
function analyzeVouchers(vouchers) {
  const stats = {
    total: vouchers.data.length,
    byType: {},
    byDate: {},
    transactionValue: 0,
    duplicates: []
  };

  // Count by type and date
  for (const voucher of vouchers.data) {
    const type = voucher.type || 'Unknown';
    const date = voucher.date || 'Unknown';

    stats.byType[type] = (stats.byType[type] || 0) + 1;
    stats.byDate[date] = (stats.byDate[date] || 0) + 1;

    // Sum transaction values
    if (voucher.details && Array.isArray(voucher.details)) {
      for (const detail of voucher.details) {
        stats.transactionValue += Math.abs(detail.amount || 0);
      }
    }
  }

  // Find duplicate entries
  const seen = new Set();
  for (const voucher of vouchers.data) {
    const key = `${voucher.type}|${voucher.referenceNumber}|${voucher.date}`;
    if (seen.has(key)) {
      stats.duplicates.push({ ...voucher, key });
    }
    seen.add(key);
  }

  return stats;
}

/**
 * Generate ledger-wise summary
 */
function generateLedgerSummary(masters, vouchers) {
  const summary = {};

  // Initialize all ledgers
  for (const ledger of masters.data.ledgers) {
    summary[ledger.name] = {
      name: ledger.name,
      openingBalance: ledger.openingBalance,
      transactions: 0,
      totalDebit: 0,
      totalCredit: 0,
      closingBalance: ledger.openingBalance
    };
  }

  // Process voucher details
  for (const voucher of vouchers.data) {
    if (voucher.details && Array.isArray(voucher.details)) {
      for (const detail of voucher.details) {
        const ledgerName = detail.ledger;
        if (ledgerName && summary[ledgerName]) {
          summary[ledgerName].transactions += 1;
          const amount = detail.amount || 0;
          
          if (amount > 0) {
            summary[ledgerName].totalDebit += amount;
          } else {
            summary[ledgerName].totalCredit += Math.abs(amount);
          }
        }
      }
    }
  }

  // Calculate closing balances
  for (const ledgerName in summary) {
    const ledger = summary[ledgerName];
    ledger.closingBalance = ledger.openingBalance + ledger.totalDebit - ledger.totalCredit;
  }

  return summary;
}

/**
 * Execute Phase 3: Analyze Data
 */
async function runPhase3() {
  progressTracker.log('', 'info');
  progressTracker.log('╔════════════════════════════════════════════╗', 'info');
  progressTracker.log('║         BIZSTASH DATA SYNC - PHASE 3       ║', 'info');
  progressTracker.log('║         ANALYZE & ENRICH DATA              ║', 'info');
  progressTracker.log('╚════════════════════════════════════════════╝', 'info');
  progressTracker.log('', 'info');

  progressTracker.startTimer('phase3_total');

  try {
    // Load Phase 2 data
    progressTracker.log('Step 1/4: Loading data...', 'info');
    progressTracker.startTimer('loadData');
    const { masters, vouchers } = await loadPhase2Data();
    progressTracker.endTimer('loadData');
    progressTracker.log(`✓ Loaded ${masters.data.ledgers.length} ledgers and ${vouchers.total} vouchers`, 'success');
    progressTracker.log('', 'info');

    // Generate trial balance
    progressTracker.log('Step 2/4: Generating trial balance...', 'info');
    progressTracker.startTimer('trialBalance');
    const trialBalance = generateTrialBalance(masters);
    progressTracker.endTimer('trialBalance');
    progressTracker.log(`✓ Trial balance: Assets=${trialBalance.assets.toFixed(2)}, Liabilities=${trialBalance.liabilities.toFixed(2)}`, 'success');
    progressTracker.log('', 'info');

    // Analyze vouchers
    progressTracker.log('Step 3/4: Analyzing vouchers...', 'info');
    progressTracker.startTimer('voucherAnalysis');
    const voucherStats = analyzeVouchers(vouchers);
    progressTracker.endTimer('voucherAnalysis');
    progressTracker.log(`✓ Analyzed ${voucherStats.total} vouchers (${Object.keys(voucherStats.byType).length} types)`, 'success');
    progressTracker.log('', 'info');

    // Generate ledger summary
    progressTracker.log('Step 4/4: Generating ledger summary...', 'info');
    progressTracker.startTimer('ledgerSummary');
    const ledgerSummary = generateLedgerSummary(masters, vouchers);
    progressTracker.endTimer('ledgerSummary');
    
    const activeLedgers = Object.values(ledgerSummary).filter(l => l.transactions > 0).length;
    progressTracker.log(`✓ Generated summaries for ${activeLedgers} active ledgers`, 'success');
    progressTracker.log('', 'info');

    // Save reports
    progressTracker.log('Saving analysis reports...', 'info');
    const analysisDir = path.join(config.DATA_DIR, 'analysis');
    await fs.ensureDir(analysisDir);

    await fs.writeJson(path.join(analysisDir, 'trial-balance.json'), trialBalance, { spaces: 2 });
    await fs.writeJson(path.join(analysisDir, 'voucher-analysis.json'), voucherStats, { spaces: 2 });
    await fs.writeJson(path.join(analysisDir, 'ledger-summary.json'), ledgerSummary, { spaces: 2 });

    progressTracker.log(`✓ Reports saved to ${analysisDir}`, 'success');
    progressTracker.log('', 'info');

    // Final report
    progressTracker.log('╔════════════════════════════════════════════╗', 'success');
    progressTracker.log('║        PHASE 3 COMPLETED SUCCESSFULLY      ║', 'success');
    progressTracker.log('╚════════════════════════════════════════════╝', 'success');

    progressTracker.endTimer('phase3_total');

    return {
      success: true,
      trialBalance,
      voucherStats,
      ledgerSummaryCount: Object.keys(ledgerSummary).length
    };

  } catch (error) {
    progressTracker.log('', 'info');
    progressTracker.log('╔════════════════════════════════════════════╗', 'error');
    progressTracker.log('║         PHASE 3 FAILED - STOPPING          ║', 'error');
    progressTracker.log('╚════════════════════════════════════════════╝', 'error');
    progressTracker.log(`Error: ${error.message}`, 'error');

    progressTracker.endTimer('phase3_total');

    return {
      success: false,
      error: error.message
    };
  }
}

// Allow running directly
if (require.main === module) {
  runPhase3()
    .then(result => {
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = {
  runPhase3,
  generateTrialBalance,
  analyzeVouchers,
  generateLedgerSummary
};
