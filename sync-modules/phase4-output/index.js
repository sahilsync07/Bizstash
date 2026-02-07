/**
 * PHASE 4: OUTPUT GENERATION
 * 
 * Strategy:
 * 1. Generate CSV exports (ledgers, vouchers, trial balance)
 * 2. Create HTML dashboard with charts
 * 3. Generate executive summary report
 * 4. Export data in multiple formats
 */

const path = require('path');
const fs = require('fs-extra');
const config = require('../../sync/config');
const progressTracker = require('../phase1-fetch/progress-tracker');

/**
 * Load analysis data
 */
async function loadAnalysisData() {
  const analysisDir = path.join(config.DATA_DIR, 'analysis');
  
  const trialBalance = await fs.readJson(path.join(analysisDir, 'trial-balance.json'));
  const voucherAnalysis = await fs.readJson(path.join(analysisDir, 'voucher-analysis.json'));
  const ledgerSummary = await fs.readJson(path.join(analysisDir, 'ledger-summary.json'));

  return { trialBalance, voucherAnalysis, ledgerSummary };
}

/**
 * Convert array of objects to CSV
 */
function toCsv(data) {
  if (!Array.isArray(data) || data.length === 0) {
    return '';
  }

  // Get headers from first object
  const headers = Object.keys(data[0]);
  
  // Create CSV rows
  const rows = [headers.join(',')];
  
  for (const item of data) {
    const values = headers.map(h => {
      const val = item[h];
      // Escape commas and quotes in values
      if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    });
    rows.push(values.join(','));
  }

  return rows.join('\n');
}

/**
 * Generate trial balance CSV
 */
function generateTrialBalanceCsv(trialBalance) {
  const rows = [
    ['Account Name', 'Category', 'Balance'],
    ...trialBalance.ledgers.map(l => [l.name, l.category, l.balance])
  ];

  return rows.map(r => r.join(',')).join('\n');
}

/**
 * Generate ledger summary CSV
 */
function generateLedgerSummaryCsv(ledgerSummary) {
  const data = Object.values(ledgerSummary).map(l => ({
    'Ledger Name': l.name,
    'Opening Balance': l.openingBalance,
    'Transactions': l.transactions,
    'Total Debit': l.totalDebit,
    'Total Credit': l.totalCredit,
    'Closing Balance': l.closingBalance
  }));

  return toCsv(data);
}

/**
 * Generate HTML dashboard
 */
function generateHtmlDashboard(trialBalance, voucherAnalysis) {
  const voucherTypes = Object.entries(voucherAnalysis.byType)
    .map(([type, count]) => `<tr><td>${type}</td><td>${count}</td></tr>`)
    .join('\n');

  const categorySummary = {
    Assets: trialBalance.assets,
    Liabilities: trialBalance.liabilities,
    Equity: trialBalance.equity,
    Income: trialBalance.income,
    Expenses: trialBalance.expenses
  };

  const categoryRows = Object.entries(categorySummary)
    .map(([cat, val]) => `<tr><td>${cat}</td><td>${val.toFixed(2)}</td></tr>`)
    .join('\n');

  return `<!DOCTYPE html>
<html>
<head>
  <title>BIZSTASH - Data Sync Dashboard</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; }
    h1 { color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px; }
    h2 { color: #555; margin-top: 30px; }
    table { border-collapse: collapse; width: 100%; margin-top: 10px; }
    table th { background: #007bff; color: white; padding: 10px; text-align: left; }
    table td { padding: 8px; border-bottom: 1px solid #ddd; }
    table tr:hover { background: #f9f9f9; }
    .stats { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px; }
    .stat-box { background: #f9f9f9; padding: 15px; border-left: 4px solid #007bff; border-radius: 4px; }
    .stat-value { font-size: 24px; font-weight: bold; color: #007bff; }
    .stat-label { font-size: 12px; color: #999; margin-top: 5px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>BIZSTASH - Data Sync Dashboard</h1>
    <p>Generated: ${new Date().toLocaleString()}</p>

    <h2>Summary Statistics</h2>
    <div class="stats">
      <div class="stat-box">
        <div class="stat-value">${voucherAnalysis.total}</div>
        <div class="stat-label">Total Vouchers</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${voucherAnalysis.transactionValue.toFixed(0)}</div>
        <div class="stat-label">Total Transaction Value</div>
      </div>
    </div>

    <h2>Account Categories</h2>
    <table>
      <thead>
        <tr>
          <th>Category</th>
          <th>Total Balance</th>
        </tr>
      </thead>
      <tbody>
        ${categoryRows}
      </tbody>
    </table>

    <h2>Voucher Types</h2>
    <table>
      <thead>
        <tr>
          <th>Type</th>
          <th>Count</th>
        </tr>
      </thead>
      <tbody>
        ${voucherTypes}
      </tbody>
    </table>
  </div>
</body>
</html>`;
}

/**
 * Generate executive summary
 */
function generateExecutiveSummary(trialBalance, voucherAnalysis) {
  return `BIZSTASH DATA SYNC - EXECUTIVE SUMMARY
${'='.repeat(60)}

Generated: ${new Date().toLocaleString()}

FINANCIAL OVERVIEW
${'-'.repeat(60)}
Assets:           ${trialBalance.assets.toFixed(2)}
Liabilities:      ${trialBalance.liabilities.toFixed(2)}
Equity:           ${trialBalance.equity.toFixed(2)}
Income:           ${trialBalance.income.toFixed(2)}
Expenses:         ${trialBalance.expenses.toFixed(2)}

Total Balance:    ${(trialBalance.assets + trialBalance.liabilities + trialBalance.equity + trialBalance.income + trialBalance.expenses).toFixed(2)}

TRANSACTION SUMMARY
${'-'.repeat(60)}
Total Vouchers:   ${voucherAnalysis.total}
Total Value:      ${voucherAnalysis.transactionValue.toFixed(2)}

Voucher Types:
${Object.entries(voucherAnalysis.byType)
  .map(([type, count]) => `  • ${type}: ${count}`)
  .join('\n')}

Data Quality Issues:
${voucherAnalysis.duplicates.length > 0 
  ? `  • Duplicate Entries: ${voucherAnalysis.duplicates.length}` 
  : '  • No duplicate entries detected'}

GENERATED OUTPUTS
${'-'.repeat(60)}
✓ trial-balance.csv      - Complete trial balance with all accounts
✓ ledger-summary.csv     - Ledger-wise transaction details
✓ dashboard.html         - Interactive dashboard
✓ executive-summary.txt  - This summary report

Generated by BIZSTASH Data Sync Engine
${new Date().toISOString()}
`;
}

/**
 * Execute Phase 4: Output Generation
 */
async function runPhase4() {
  progressTracker.log('', 'info');
  progressTracker.log('╔════════════════════════════════════════════╗', 'info');
  progressTracker.log('║         BIZSTASH DATA SYNC - PHASE 4       ║', 'info');
  progressTracker.log('║           GENERATE OUTPUT REPORTS          ║', 'info');
  progressTracker.log('╚════════════════════════════════════════════╝', 'info');
  progressTracker.log('', 'info');

  progressTracker.startTimer('phase4_total');

  try {
    // Load analysis data
    progressTracker.log('Step 1/4: Loading analysis data...', 'info');
    progressTracker.startTimer('loadData');
    const { trialBalance, voucherAnalysis, ledgerSummary } = await loadAnalysisData();
    progressTracker.endTimer('loadData');
    progressTracker.log('✓ Loaded analysis data', 'success');
    progressTracker.log('', 'info');

    // Generate CSV files
    progressTracker.log('Step 2/4: Generating CSV exports...', 'info');
    progressTracker.startTimer('csvExport');
    
    const outputDir = path.join(config.DATA_DIR, 'reports');
    await fs.ensureDir(outputDir);

    const trialBalanceCsv = generateTrialBalanceCsv(trialBalance);
    const ledgerSummaryCsv = generateLedgerSummaryCsv(ledgerSummary);

    await fs.writeFile(path.join(outputDir, 'trial-balance.csv'), trialBalanceCsv);
    await fs.writeFile(path.join(outputDir, 'ledger-summary.csv'), ledgerSummaryCsv);

    progressTracker.endTimer('csvExport');
    progressTracker.log('✓ CSV exports generated', 'success');
    progressTracker.log('', 'info');

    // Generate HTML dashboard
    progressTracker.log('Step 3/4: Generating HTML dashboard...', 'info');
    progressTracker.startTimer('htmlDashboard');
    
    const htmlContent = generateHtmlDashboard(trialBalance, voucherAnalysis);
    await fs.writeFile(path.join(outputDir, 'dashboard.html'), htmlContent);

    progressTracker.endTimer('htmlDashboard');
    progressTracker.log('✓ HTML dashboard generated', 'success');
    progressTracker.log('', 'info');

    // Generate executive summary
    progressTracker.log('Step 4/4: Generating executive summary...', 'info');
    progressTracker.startTimer('summary');
    
    const summary = generateExecutiveSummary(trialBalance, voucherAnalysis);
    await fs.writeFile(path.join(outputDir, 'executive-summary.txt'), summary);

    progressTracker.endTimer('summary');
    progressTracker.log('✓ Executive summary generated', 'success');
    progressTracker.log('', 'info');

    // Final report
    progressTracker.log('╔════════════════════════════════════════════╗', 'success');
    progressTracker.log('║        PHASE 4 COMPLETED SUCCESSFULLY      ║', 'success');
    progressTracker.log('╚════════════════════════════════════════════╝', 'success');
    progressTracker.log(`Reports saved to: ${outputDir}`, 'success');

    progressTracker.endTimer('phase4_total');

    return {
      success: true,
      outputDir,
      filesGenerated: [
        'trial-balance.csv',
        'ledger-summary.csv',
        'dashboard.html',
        'executive-summary.txt'
      ]
    };

  } catch (error) {
    progressTracker.log('', 'info');
    progressTracker.log('╔════════════════════════════════════════════╗', 'error');
    progressTracker.log('║         PHASE 4 FAILED - STOPPING          ║', 'error');
    progressTracker.log('╚════════════════════════════════════════════╝', 'error');
    progressTracker.log(`Error: ${error.message}`, 'error');

    progressTracker.endTimer('phase4_total');

    return {
      success: false,
      error: error.message
    };
  }
}

// Allow running directly
if (require.main === module) {
  runPhase4()
    .then(result => {
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = {
  runPhase4,
  generateTrialBalanceCsv,
  generateHtmlDashboard,
  generateExecutiveSummary
};
