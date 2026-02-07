#!/usr/bin/env node

/**
 * MINIMAL TEST - Single safe request to Tally
 * Tests connection WITHOUT retry loops or aggressive requests
 */

const axios = require('axios');

const TALLY_URL = 'http://localhost:9000';

async function testSimpleConnection() {
  console.log('\n🔍 Testing basic connection to Tally...\n');

  try {
    console.log('[1] Sending simple GET request (health check)...');
    const getResponse = await axios.get(TALLY_URL, {
      timeout: 10000  // 10 seconds
    });
    console.log('✅ GET request successful');
    console.log(`   Status: ${getResponse.status}`);
    console.log(`   Response: ${getResponse.data.substring(0, 50)}...\n`);

    // Small delay before next request
    await new Promise(r => setTimeout(r, 2000));

    console.log('[2] Sending minimal Statistics TDL request...');
    const tdlXml = `<ENVELOPE>
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

    const postResponse = await axios.post(TALLY_URL, tdlXml, {
      headers: { 'Content-Type': 'text/xml' },
      timeout: 60000,  // 60 seconds for data export
      validateStatus: () => true  // Accept any status
    });

    console.log(`✅ POST request successful`);
    console.log(`   Status: ${postResponse.status}`);
    console.log(`   Response size: ${postResponse.data.length} bytes`);
    console.log(`   First 100 chars: ${postResponse.data.substring(0, 100)}...\n`);

    if (postResponse.data.includes('STATISTICS')) {
      console.log('✅ Valid Statistics response received\n');
      return true;
    } else {
      console.log('⚠️  Response doesn\'t contain expected Statistics tag\n');
      return false;
    }

  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.error(`   Error code: ${error.code}`);
    console.error(`   Timeout: ${error.timeout}ms\n`);
    return false;
  }
}

testSimpleConnection()
  .then(success => {
    if (success) {
      console.log('✅ SAFE TEST PASSED - Tally is accessible and responding\n');
      process.exit(0);
    } else {
      console.log('⚠️  Test completed but response was unexpected\n');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
