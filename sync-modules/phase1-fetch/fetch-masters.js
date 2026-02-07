/**
 * FETCH MASTERS - Extract all ledgers and groups from Tally
 * 
 * Single Tally API call to get:
 * - All ledger accounts
 * - All groups and group hierarchy
 * - Opening balances
 */

const fs = require('fs-extra');
const path = require('path');
const config = require('../../sync/config');
const { fetchFromTally } = require('./tally-connector');
const progressTracker = require('./progress-tracker');

/**
 * Fetch all masters from Tally
 * @param {string} company - Company name/ID
 * @returns {Promise<object>} { ledgers, groups, success }
 */
async function fetchMasters(company = config.DEFAULT_COMPANY) {
  progressTracker.log('═══════════════════════════════════════════', 'info');
  progressTracker.log('PHASE 1: FETCH MASTERS', 'info');
  progressTracker.log('═══════════════════════════════════════════', 'info');
  
  progressTracker.startTimer('fetchMasters');

  try {
    // Ensure output directory
    fs.ensureDirSync(config.MASTERS_DIR);

    // TDL Request for all masters
    const tdl = `
    <ENVELOPE>
        <HEADER>
            <TALLYREQUEST>Export Data</TALLYREQUEST>
        </HEADER>
        <BODY>
            <EXPORTDATA>
                <REQUESTDESC>
                    <REPORTNAME>List of Accounts</REPORTNAME>
                    <STATICVARIABLES>
                        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
                        <ACCOUNTTYPE>All Masters</ACCOUNTTYPE>
                    </STATICVARIABLES>
                </REQUESTDESC>
            </EXPORTDATA>
        </BODY>
    </ENVELOPE>`;

    progressTracker.log(`Fetching all masters from Tally...`, 'info');
    const response = await fetchFromTally(tdl, 'Masters Fetch');

    if (!response || response.length === 0) {
      throw new Error('No data received from Tally');
    }

    // Save raw XML
    const xmlFile = path.join(config.MASTERS_DIR, 'masters.xml');
    fs.writeFileSync(xmlFile, response);
    progressTracker.log(`✓ Masters XML saved (${(response.length / 1024).toFixed(1)} KB)`, 'success');

    // Count ledgers and groups
    const ledgerMatches = [...response.matchAll(/<LEDGER[^>]*NAME="([^"]+)"/gi)];
    const groupMatches = [...response.matchAll(/<GROUP[^>]*NAME="([^"]+)"/gi)];

    progressTracker.log(`✓ Found ${ledgerMatches.length} ledgers`, 'success');
    progressTracker.log(`✓ Found ${groupMatches.length} groups`, 'success');

    progressTracker.metric('masters_ledgers', ledgerMatches.length);
    progressTracker.metric('masters_groups', groupMatches.length);
    progressTracker.metric('masters_size_kb', Math.round(response.length / 1024));

    progressTracker.endTimer('fetchMasters');

    return {
      success: true,
      ledgers: ledgerMatches.length,
      groups: groupMatches.length,
      xmlFile
    };

  } catch (error) {
    progressTracker.log(`✗ Failed to fetch masters: ${error.message}`, 'error');
    progressTracker.endTimer('fetchMasters');
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  fetchMasters
};
