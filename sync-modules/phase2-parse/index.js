/**
 * PHASE 2: PARSE XML - Convert XML to JSON
 * 
 * Strategy:
 * 1. Parse Masters XML → Extract ledgers, groups, currencies
 * 2. Parse Vouchers XML → Extract journal entries
 * 3. Create indexed JSON for efficient lookups
 * 4. Validate data consistency
 */

const path = require('path');
const fs = require('fs-extra');
const config = require('../../sync/config');
const progressTracker = require('../phase1-fetch/progress-tracker');

/**
 * Parse Masters XML and extract structured data
 */
async function parseMasters(mastersPath) {
  progressTracker.log('Parsing Masters XML...', 'info');
  progressTracker.startTimer('parseMasters');

  try {
    const data = fs.readFileSync(mastersPath, 'utf8');

    // Parse ledgers
    const ledgerMatches = data.matchAll(/<LEDGER[^>]*>[\s\S]*?<\/LEDGER>/g);
    const ledgers = [];

    for (const match of ledgerMatches) {
      const ledgerXml = match[0];
      const name = extractXmlValue(ledgerXml, 'NAME');
      const parent = extractXmlValue(ledgerXml, 'PARENT');
      const ledgerGroup = extractXmlValue(ledgerXml, 'LEDGERGROUP');
      const openBalance = extractXmlValue(ledgerXml, 'OPENINGBALANCE');

      if (name) {
        ledgers.push({
          name,
          parent,
          ledgerGroup,
          openingBalance: parseFloat(openBalance) || 0
        });
      }
    }

    // Parse groups
    const groupMatches = data.matchAll(/<GROUP[^>]*>[\s\S]*?<\/GROUP>/g);
    const groups = [];

    for (const match of groupMatches) {
      const groupXml = match[0];
      const name = extractXmlValue(groupXml, 'NAME');
      const parent = extractXmlValue(groupXml, 'PARENT');

      if (name) {
        groups.push({ name, parent });
      }
    }

    progressTracker.log(`✓ Parsed ${ledgers.length} ledgers and ${groups.length} groups`, 'success');
    progressTracker.endTimer('parseMasters');

    return { ledgers, groups };

  } catch (error) {
    progressTracker.log(`✗ Masters parsing failed: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Parse Vouchers XML and extract journal entries
 */
async function parseVouchers(vouchersDir) {
  progressTracker.log('Parsing Vouchers XML...', 'info');
  progressTracker.startTimer('parseVouchers');

  try {
    const files = fs.readdirSync(vouchersDir)
      .filter(f => f.endsWith('.xml'))
      .sort();

    const vouchers = [];
    let processedFiles = 0;

    for (const file of files) {
      const filePath = path.join(vouchersDir, file);
      const data = fs.readFileSync(filePath, 'utf8');

      // Parse voucher entries
      const voucherMatches = data.matchAll(/<VOUCHER[^>]*>[\s\S]*?<\/VOUCHER>/g);

      for (const match of voucherMatches) {
        const voucherXml = match[0];
        const voucherType = extractXmlValue(voucherXml, 'VOUCHERTYPENAME');
        const referenceNumber = extractXmlValue(voucherXml, 'REFERENCENUMBER');
        const date = extractXmlValue(voucherXml, 'DATE');

        if (voucherType && date) {
          // Parse voucher details
          const details = [];
          const detailMatches = voucherXml.matchAll(/<LEDGERENTRIES[\s\S]*?>[\s\S]*?<\/LEDGERENTRIES>/g);

          for (const detailMatch of detailMatches) {
            const detailXml = detailMatch[0];
            const ledger = extractXmlValue(detailXml, 'LEDGERNAME');
            const amount = extractXmlValue(detailXml, 'AMOUNT');

            if (ledger) {
              details.push({
                ledger,
                amount: parseFloat(amount) || 0
              });
            }
          }

          vouchers.push({
            type: voucherType,
            referenceNumber,
            date,
            details
          });
        }
      }

      processedFiles++;
      if (processedFiles % 10 === 0) {
        progressTracker.log(`  → Processed ${processedFiles}/${files.length} files...`, 'debug');
      }
    }

    progressTracker.log(`✓ Parsed ${vouchers.length} vouchers from ${files.length} files`, 'success');
    progressTracker.endTimer('parseVouchers');

    return vouchers;

  } catch (error) {
    progressTracker.log(`✗ Vouchers parsing failed: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Extract value from XML tag
 */
function extractXmlValue(xml, tagName) {
  const regex = new RegExp(`<${tagName}>([^<]*)</${tagName}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : '';
}

/**
 * Execute Phase 2: Parse XML to JSON
 */
async function runPhase2() {
  progressTracker.log('', 'info');
  progressTracker.log('╔════════════════════════════════════════════╗', 'info');
  progressTracker.log('║         BIZSTASH DATA SYNC - PHASE 2       ║', 'info');
  progressTracker.log('║           PARSE XML TO JSON                ║', 'info');
  progressTracker.log('╚════════════════════════════════════════════╝', 'info');
  progressTracker.log('', 'info');

  progressTracker.startTimer('phase2_total');

  try {
    // Parse Masters
    progressTracker.log('Step 1/3: Parsing Masters...', 'info');
    const mastersPath = path.join(config.MASTERS_DIR, 'masters.xml');
    const mastersData = await parseMasters(mastersPath);
    progressTracker.log('', 'info');

    // Parse Vouchers
    progressTracker.log('Step 2/3: Parsing Vouchers...', 'info');
    const vouchers = await parseVouchers(config.VOUCHERS_DIR);
    progressTracker.log('', 'info');

    // Save to JSON
    progressTracker.log('Step 3/3: Saving to JSON...', 'info');
    progressTracker.startTimer('saveJson');

    const jsonDir = path.join(config.DATA_DIR, 'json');
    await fs.ensureDir(jsonDir);

    // Save Masters
    const mastersSummary = {
      ledgers: mastersData.ledgers.length,
      groups: mastersData.groups.length,
      data: mastersData
    };
    await fs.writeJson(path.join(jsonDir, 'masters.json'), mastersSummary, { spaces: 2 });
    progressTracker.log(`✓ Masters JSON saved (${mastersData.ledgers.length} ledgers)`, 'success');

    // Save Vouchers
    const vouchersSummary = {
      total: vouchers.length,
      data: vouchers
    };
    await fs.writeJson(path.join(jsonDir, 'vouchers.json'), vouchersSummary, { spaces: 2 });
    progressTracker.log(`✓ Vouchers JSON saved (${vouchers.length} vouchers)`, 'success');

    progressTracker.endTimer('saveJson');
    progressTracker.log('', 'info');

    // Final report
    progressTracker.log('╔════════════════════════════════════════════╗', 'success');
    progressTracker.log('║        PHASE 2 COMPLETED SUCCESSFULLY      ║', 'success');
    progressTracker.log('╚════════════════════════════════════════════╝', 'success');

    progressTracker.endTimer('phase2_total');

    return {
      success: true,
      masters: mastersData,
      vouchers,
      output: jsonDir
    };

  } catch (error) {
    progressTracker.log('', 'info');
    progressTracker.log('╔════════════════════════════════════════════╗', 'error');
    progressTracker.log('║         PHASE 2 FAILED - STOPPING          ║', 'error');
    progressTracker.log('╚════════════════════════════════════════════╝', 'error');
    progressTracker.log(`Error: ${error.message}`, 'error');

    progressTracker.endTimer('phase2_total');

    return {
      success: false,
      error: error.message
    };
  }
}

// Allow running directly
if (require.main === module) {
  runPhase2()
    .then(result => {
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = {
  runPhase2,
  parseMasters,
  parseVouchers
};
