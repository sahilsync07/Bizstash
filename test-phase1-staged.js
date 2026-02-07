#!/usr/bin/env node

/**
 * STAGED TEST - Progressive validation of Phase 1 components
 * Each stage carefully tests one piece before moving to the next
 */

const axios = require('axios');
const path = require('path');
const fs = require('fs-extra');

const config = require('./sync/config');

const stages = [];
let passed = 0;
let failed = 0;

async function stage(name, fn) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`STAGE: ${name}`);
  console.log('='.repeat(60));
  
  try {
    await fn();
    console.log(`✅ PASSED\n`);
    passed++;
  } catch (error) {
    console.error(`❌ FAILED: ${error.message}\n`);
    failed++;
    throw error;  // Stop on first failure
  }
}

async function main() {
  console.log('\n🔍 BIZSTASH PHASE 1 - STAGED TEST\n');

  try {
    // Stage 1: Verify Tally is accessible
    await stage('1: Tally Connectivity Check', async () => {
      console.log('Pinging Tally on localhost:9000...');
      const resp = await axios.get('http://localhost:9000', { timeout: 10000 });
      console.log(`✓ Tally responds: "${resp.data.substring(0, 40)}..."`);
      console.log(`✓ Response time: ${resp.headers['date'] || 'N/A'}`);
    });

    // Stage 2: Test Statistics request (small response)
    await stage('2: Test Statistics Request (Small Response)', async () => {
      console.log('Sending Statistics request...');
      const tdl = `<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Export Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <EXPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Statistics</REPORTNAME>
        <STATICVARIABLES>
          <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        </STATICVARIABLES>
      </REQUESTDESC>
    </EXPORTDATA>
  </BODY>
</ENVELOPE>`;

      const start = Date.now();
      const resp = await axios.post('http://localhost:9000', tdl, {
        headers: { 'Content-Type': 'text/xml' },
        timeout: 180000,
        maxContentLength: Infinity
      });
      const elapsed = Date.now() - start;

      console.log(`✓ Response size: ${(resp.data.length / 1024).toFixed(1)} KB`);
      console.log(`✓ Response time: ${elapsed}ms`);
      console.log(`✓ Contains STATNAME: ${resp.data.includes('STATNAME')}`);
    });

    // Stage 3: Wait before next request
    await stage('3: Pause Between Requests', async () => {
      console.log(`Waiting ${config.BATCH_DELAY} seconds...`);
      await new Promise(r => setTimeout(r, config.BATCH_DELAY * 1000));
      console.log('✓ Pause complete');
    });

    // Stage 4: Test List of Accounts (LARGE response - 27MB!)
    await stage('4: Test Masters Request (Large Response)', async () => {
      console.log('Sending List of Accounts request...');
      console.log('⚠️  This will download ~27MB and may take 30+ seconds\n');

      const tdl = `<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Export Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <EXPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>List of Accounts</REPORTNAME>
        <STATICVARIABLES>
          <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        </STATICVARIABLES>
      </REQUESTDESC>
    </EXPORTDATA>
  </BODY>
</ENVELOPE>`;

      const start = Date.now();
      const resp = await axios.post('http://localhost:9000', tdl, {
        headers: { 'Content-Type': 'text/xml' },
        timeout: 180000,
        maxContentLength: Infinity
      });
      const elapsed = Date.now() - start;

      const ledgers = (resp.data.match(/<LEDGER/g) || []).length;
      const groups = (resp.data.match(/<GROUP/g) || []).length;

      console.log(`✓ Response size: ${(resp.data.length / (1024 * 1024)).toFixed(1)} MB`);
      console.log(`✓ Response time: ${(elapsed / 1000).toFixed(1)} seconds`);
      console.log(`✓ Ledgers found: ${ledgers}`);
      console.log(`✓ Groups found: ${groups}`);

      // Save for inspection
      fs.ensureDirSync(config.MASTERS_DIR);
      fs.writeFileSync(path.join(config.MASTERS_DIR, 'masters-test.xml'), resp.data);
      console.log(`✓ Saved to: ${path.join(config.MASTERS_DIR, 'masters-test.xml')}`);
    });

    // Stage 5: Test date range detection
    await stage('5: Test Statistics for Date Range', async () => {
      console.log('Sending Statistics request (for date detection)...');
      const tdl = `<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Export Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <EXPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Statistics</REPORTNAME>
        <STATICVARIABLES>
          <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        </STATICVARIABLES>
      </REQUESTDESC>
    </EXPORTDATA>
  </BODY>
</ENVELOPE>`;

      const resp = await axios.post('http://localhost:9000', tdl, {
        headers: { 'Content-Type': 'text/xml' },
        timeout: 180000,
        maxContentLength: Infinity
      });

      const fromMatch = resp.data.match(/<STATISTICSFROMDATE>(\d{4}-\d{2}-\d{2})/);
      const toMatch = resp.data.match(/<STATISTICSTODATE>(\d{4}-\d{2}-\d{2})/);

      if (fromMatch && toMatch) {
        console.log(`✓ Financial year: ${fromMatch[1]} to ${toMatch[1]}`);
      } else {
        console.log('⚠️  Could not extract date range');
      }
    });

    // Summary
    console.log(`\n${'='.repeat(60)}`);
    console.log(`SUMMARY`);
    console.log('='.repeat(60));
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log('\n🎉 All stages completed successfully!\n');
    console.log('Next: Run full Phase 1 with: node test-phase1.js\n');

    process.exit(0);

  } catch (error) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`STAGED TEST STOPPED AT FAILURE`);
    console.log('='.repeat(60));
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}\n`);
    console.log('⚠️  Fix the issue and try again\n');
    process.exit(1);
  }
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
