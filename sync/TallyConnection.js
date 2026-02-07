const axios = require('axios');
const http = require('http');
const CONFIG = require('./config');
const Logger = require('./utils/Logger');
const RetryHelper = require('./utils/RetryHelper');

class TallyConnection {
    constructor() {
        this.agent = new http.Agent({ keepAlive: false });
        this.queue = Promise.resolve();
    }

    /**
     * Sends a TDL request to Tally with queueing and retry logic.
     * @param {string} payload - The XML TDL payload.
     * @param {object} options - Optional headers or timeout overrides.
     */
    async send(payload) {
        // Enqueue the request to ensure sequential execution
        const result = await this.queue.then(async () => {
            await this._waitCooldown();
            return RetryHelper.withRetry(
                () => this._executeRequest(payload),
                'Tally Request'
            );
        });

        // Chain continues
        this.queue = Promise.resolve(result).catch(() => { });
        return result;
    }

    async _waitCooldown() {
        if (CONFIG.SETTINGS.COOLDOWN_MS > 0) {
            await new Promise(r => setTimeout(r, CONFIG.SETTINGS.COOLDOWN_MS));
        }
    }

    async _executeRequest(payload) {
        try {
            const response = await axios.post(CONFIG.TALLY_URL, payload, {
                headers: {
                    'Content-Type': 'text/xml;charset=utf-8', // Specific charset as per best practice
                    'Connection': 'close' // FORCE close
                },
                httpAgent: this.agent,
                timeout: CONFIG.SETTINGS.REQUEST_TIMEOUT,
                responseType: 'text' // We expect XML string
            });

            if (!response.data) {
                throw new Error("Empty response from Tally");
            }

            // Check for TDL Line Errors in response (soft errors)
            if (response.data.includes('<LINEERROR>')) {
                const errorMatch = response.data.match(/<LINEERROR>(.*?)<\/LINEERROR>/);
                const errorMsg = errorMatch ? errorMatch[1] : 'Unknown TDL Error';
                throw new Error(`Tally returned TDL Error: ${errorMsg}`);
            }

            return response.data;

        } catch (error) {
            // Enhance error message
            if (error.code === 'ECONNREFUSED') {
                throw new Error(`Tally not reachable at ${CONFIG.TALLY_URL}. Is Tally running?`);
            }
            throw error;
        }
    }
}

module.exports = new TallyConnection();
