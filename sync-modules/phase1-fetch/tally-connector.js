/**
 * TALLY CONNECTOR - Low-level HTTP Communication with Retry Logic
 * 
 * CRITICAL: 
 * - READ-ONLY to Tally (only POST export requests)
 * - Retry logic with exponential backoff
 * - Proper error handling and timeout management
 * - Disable keep-alive to prevent connection issues
 */

const axios = require('axios');
const http = require('http');
const https = require('https');
const config = require('../../sync/config');
const progressTracker = require('./progress-tracker');

// Disable keep-alive for cleaner connections
const httpAgent = new http.Agent({ keepAlive: false });
const httpsAgent = new https.Agent({ keepAlive: false });

/**
 * Post XML request to Tally with automatic retry logic
 * @param {string} tdlXml - Tally TDL/XML request
 * @param {string} operationName - Operation name for logging
 * @returns {Promise<string>} Response XML from Tally
 */
async function fetchFromTally(tdlXml, operationName = 'Tally Request') {
  let lastError;
  
  for (let attempt = 1; attempt <= config.RETRY_ATTEMPTS; attempt++) {
    try {
      progressTracker.log(
        `[Attempt ${attempt}/${config.RETRY_ATTEMPTS}] ${operationName}...`,
        'debug'
      );

      const response = await axios.post(config.TALLY_URL, tdlXml, {
        headers: {
          'Content-Type': 'text/xml'
          // Removed 'Connection': 'close' - let axios handle it naturally
        },
        httpAgent,
        httpsAgent,
        timeout: config.REQUEST_TIMEOUT,
        maxContentLength: Infinity,  // Allow large responses (27+ MB)
        validateStatus: () => true  // Accept any status code
      });

      // Validate response
      if (!response.data) {
        throw new Error('Empty response from Tally');
      }

      // Check status - Tally usually returns 200 but also accept other codes for XML responses
      if (response.status < 200 || response.status >= 400) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Convert response.data to string if needed
      const responseStr = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);

      // Check for Tally errors in response (but allow partial errors in data export)
      if (responseStr.includes('<ERROR') && !responseStr.includes('<STATISTICS>')) {
        const errorMatch = responseStr.match(/<ERROR[^>]*>([^<]+)<\/ERROR>/i);
        const errorMsg = errorMatch ? errorMatch[1] : 'Unknown Tally error';
        throw new Error(`Tally Error: ${errorMsg}`);
      }

      progressTracker.log(`✓ ${operationName} success`, 'debug');
      return responseStr;

    } catch (error) {
      lastError = error;
      progressTracker.log(
        `✗ Attempt ${attempt} failed: ${error.message}`,
        'warn'
      );

      if (attempt < config.RETRY_ATTEMPTS) {
        const delayMs = config.RETRY_DELAY * Math.pow(config.RETRY_BACKOFF, attempt - 1);
        progressTracker.log(
          `  Retrying in ${(delayMs / 1000).toFixed(1)}s...`,
          'info'
        );
        await sleep(delayMs);
      }
    }
  }

  // All retries failed
  progressTracker.log(
    `✗ ${operationName} failed after ${config.RETRY_ATTEMPTS} attempts: ${lastError.message}`,
    'error'
  );
  throw lastError;
}

/**
 * Helper: Sleep for N milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Validate Tally connection (test request)
 * @returns {Promise<{success, responseTime, error}>}
 */
async function testConnection() {
  try {
    progressTracker.log('Testing Tally connection...', 'info');
    const startTime = Date.now();
    
    // Send minimal request to test connectivity
    const testXml = `
      <ENVELOPE>
        <HEADER>
          <TALLYREQUEST>Export Data</TALLYREQUEST>
        </HEADER>
        <BODY>
          <EXPORTDATA>
            <REQUESTDESC>
              <REPORTNAME>Statistics</REPORTNAME>
              <STATICVARIABLES>
                <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
                <SVFROMDATE>20240401</SVFROMDATE>
                <SVTODATE>20240402</SVTODATE>
              </STATICVARIABLES>
            </REQUESTDESC>
          </EXPORTDATA>
        </BODY>
      </ENVELOPE>`;

    const response = await fetchFromTally(testXml, 'Connection Test');
    const responseTime = Date.now() - startTime;
    
    if (response && response.length > 0) {
      progressTracker.log(`✓ Tally is reachable and responding (${responseTime}ms)`, 'success');
      return {
        success: true,
        responseTime
      };
    }
    
    return {
      success: false,
      error: 'No response from Tally'
    };
  } catch (error) {
    progressTracker.log(
      `✗ Tally connection failed: ${error.message}`,
      'error'
    );
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  fetchFromTally,
  testConnection,
  sleep
};
