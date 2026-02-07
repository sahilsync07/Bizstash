/**
 * FETCH VOUCHERS - Extract all vouchers progressively by month
 * 
 * CRITICAL REQUIREMENT: 2.5 second delay between each month batch
 * This prevents Tally from crashing under concurrent requests
 * 
 * Strategy:
 * 1. Get company date range from Statistics
 * 2. Calculate all months in range
 * 3. For each month: fetch vouchers, pause 2.5s, save
 */

const fs = require('fs-extra');
const path = require('path');
const config = require('../../sync/config');
const { fetchFromTally, sleep } = require('./tally-connector');
const progressTracker = require('./progress-tracker');

/**
 * Get company financial year range from Masters file
 * Extracts min/max dates from ledger records
 * @returns {Promise<{fromDate, toDate}>}
 */
async function detectCompanyDateRange() {
  progressTracker.log('', 'info');
  progressTracker.log('Detecting company financial year...', 'info');
  progressTracker.startTimer('detectDateRange');

  try {
    const mastersPath = path.join(config.MASTERS_DIR, 'masters.xml');
    
    if (!fs.existsSync(mastersPath)) {
      throw new Error('Masters file not found - run fetch-masters first');
    }

    const mastersData = fs.readFileSync(mastersPath, 'utf8');

    // Extract all CREATEDDATE values from ledger records
    const dateMatches = mastersData.match(/<CREATEDDATE>(\d{8})<\/CREATEDDATE>/g);
    
    if (!dateMatches || dateMatches.length === 0) {
      // Fallback: use a standard financial year (Apr - Mar)
      const now = new Date();
      const year = now.getMonth() < 3 ? now.getFullYear() - 1 : now.getFullYear();
      const fromDate = `${year}-04-01`;
      const toDate = `${year + 1}-03-31`;
      
      progressTracker.log(`✓ Financial year (fallback): ${fromDate} to ${toDate}`, 'success');
      progressTracker.endTimer('detectDateRange');
      return { fromDate, toDate };
    }

    // Convert YYYYMMDD to YYYY-MM-DD and find min/max
    const dates = dateMatches
      .map(m => m.match(/\d{8}/)[0])
      .map(d => `${d.substring(0, 4)}-${d.substring(4, 6)}-${d.substring(6, 8)}`)
      .sort();

    const fromDate = dates[0];
    const toDate = dates[dates.length - 1];

    progressTracker.log(`✓ Financial year: ${fromDate} to ${toDate}`, 'success');
    progressTracker.endTimer('detectDateRange');

    return { fromDate, toDate };

  } catch (error) {
    progressTracker.log(`✗ Date range detection failed: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Generate array of month ranges between two dates
 * @param {string} fromDate - YYYY-MM-DD format
 * @param {string} toDate - YYYY-MM-DD format
 * @returns {Array<{month, year, start, end}>}
 */
function generateMonthBatches(fromDate, toDate) {
  const months = [];
  const [fromY, fromM, fromD] = fromDate.split('-').map(Number);
  const [toY, toM, toD] = toDate.split('-').map(Number);

  let current = new Date(fromY, fromM - 1, fromD);
  let end = new Date(toY, toM - 1, toD);

  while (current <= end) {
    const year = current.getFullYear();
    const month = current.getMonth() + 1;
    const monthPadded = String(month).padStart(2, '0');

    // Start: first day of month
    const monthStart = `${year}-${monthPadded}-01`;

    // End: last day of month
    const nextMonth = new Date(year, month, 0);
    const endDay = String(nextMonth.getDate()).padStart(2, '0');
    const monthEnd = `${year}-${monthPadded}-${endDay}`;

    months.push({
      month,
      year,
      display: `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][month - 1]} ${year}`,
      start: monthStart,
      end: monthEnd,
      filename: `${year}${monthPadded}.xml`
    });

    // Move to next month
    current = new Date(year, month, 1);
  }

  return months;
}

/**
 * Fetch vouchers for a specific month
 * @param {string} startDate - YYYY-MM-DD format
 * @param {string} endDate - YYYY-MM-DD format
 * @param {string} monthLabel - Display label (e.g., "Jan 2024")
 * @returns {Promise<{success, records, size}>}
 */
async function fetchVouchersForMonth(startDate, endDate, monthLabel) {
  try {
    const tdl = `
    <ENVELOPE>
        <HEADER>
            <TALLYREQUEST>Export Data</TALLYREQUEST>
        </HEADER>
        <BODY>
            <EXPORTDATA>
                <REQUESTDESC>
                    <REPORTNAME>Vouchers</REPORTNAME>
                    <STATICVARIABLES>
                        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
                        <VOUCHERSORTTYPE>$$SysName:VoucherDate</VOUCHERSORTTYPE>
                        <FROMDATE>${startDate}</FROMDATE>
                        <TODATE>${endDate}</TODATE>
                    </STATICVARIABLES>
                </REQUESTDESC>
            </EXPORTDATA>
        </BODY>
    </ENVELOPE>`;

    const response = await fetchFromTally(tdl, `Vouchers ${monthLabel}`);

    if (!response || response.length === 0) {
      return { success: false, records: 0, size: 0 };
    }

    // Count vouchers in response
    const voucherMatches = [...response.matchAll(/<VOUCHER[^>]*>/gi)];

    return {
      success: true,
      records: voucherMatches.length,
      size: response.length,
      data: response
    };

  } catch (error) {
    progressTracker.log(`  ✗ ${monthLabel}: ${error.message}`, 'error');
    return { success: false, records: 0, size: 0, error: error.message };
  }
}

/**
 * Fetch all vouchers with progressive monthly batching
 * CRITICAL: 2.5 second delay between batches to prevent Tally crash
 */
async function fetchVouchersByMonth() {
  progressTracker.log('', 'info');
  progressTracker.log('═══════════════════════════════════════════', 'info');
  progressTracker.log('PHASE 1: FETCH VOUCHERS (PROGRESSIVE)', 'info');
  progressTracker.log('═══════════════════════════════════════════', 'info');

  progressTracker.startTimer('fetchVouchers');

  try {
    // Ensure output directory
    fs.ensureDirSync(config.VOUCHERS_DIR);

    // Step 1: Get date range
    const { fromDate, toDate } = await detectCompanyDateRange();

    // Step 2: Generate month batches
    const months = generateMonthBatches(fromDate, toDate);
    progressTracker.log(``, 'info');
    progressTracker.log(`Fetching ${months.length} months of vouchers...`, 'info');

    let totalRecords = 0;
    let totalSize = 0;
    let successCount = 0;
    const results = [];

    // Step 3: Fetch each month with 2.5s delay between batches
    for (let i = 0; i < months.length; i++) {
      const month = months[i];
      const progress = `[${i + 1}/${months.length}]`;

      try {
        // Fetch vouchers for this month
        const result = await fetchVouchersForMonth(month.start, month.end, month.display);

        if (result.success) {
          // Save to file
          const filePath = path.join(config.VOUCHERS_DIR, month.filename);
          fs.writeFileSync(filePath, result.data);

          totalRecords += result.records;
          totalSize += result.size;
          successCount++;

          progressTracker.log(
            `  ${progress} ${month.display.padEnd(12)} → ${result.records} vouchers (${(result.size / 1024).toFixed(1)} KB)`,
            'success'
          );

          results.push({
            month: month.display,
            records: result.records,
            success: true,
            file: month.filename
          });
        } else {
          progressTracker.log(`  ${progress} ${month.display.padEnd(12)} → No vouchers`, 'warning');
          results.push({
            month: month.display,
            records: 0,
            success: false,
            reason: result.error || 'No data'
          });
        }

        // CRITICAL: 2.5 second delay between month batches
        // This prevents Tally from crashing under rapid requests
        if (i < months.length - 1) {
          const delayMs = config.BATCH_DELAY * 1000; // Convert to ms
          progressTracker.log(`  ↳ Pausing ${config.BATCH_DELAY}s before next batch...`, 'debug');
          await sleep(delayMs);
        }

      } catch (error) {
        progressTracker.log(`  ${progress} ${month.display.padEnd(12)} → ERROR: ${error.message}`, 'error');
        results.push({
          month: month.display,
          records: 0,
          success: false,
          error: error.message
        });
      }
    }

    // Summary
    progressTracker.log(``, 'info');
    progressTracker.log(`✓ Batch complete: ${successCount}/${months.length} months fetched`, 'success');
    progressTracker.log(`✓ Total vouchers: ${totalRecords}`, 'success');
    progressTracker.log(`✓ Total data: ${(totalSize / (1024 * 1024)).toFixed(2)} MB`, 'success');

    progressTracker.metric('vouchers_months_total', months.length);
    progressTracker.metric('vouchers_months_success', successCount);
    progressTracker.metric('vouchers_total_records', totalRecords);
    progressTracker.metric('vouchers_total_size_mb', Math.round(totalSize / (1024 * 1024)));

    progressTracker.endTimer('fetchVouchers');

    return {
      success: successCount > 0,
      monthsTotal: months.length,
      monthsSuccess: successCount,
      totalRecords,
      totalSize,
      results
    };

  } catch (error) {
    progressTracker.log(`✗ Voucher fetch failed: ${error.message}`, 'error');
    progressTracker.endTimer('fetchVouchers');
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  fetchVouchersByMonth,
  fetchVouchersForMonth,
  detectCompanyDateRange,
  generateMonthBatches
};
