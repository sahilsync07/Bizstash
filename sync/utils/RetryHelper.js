const Logger = require('./Logger');

class RetryHelper {
    static async withRetry(fn, operationName, maxAttempts = 3, delayMs = 1000) {
        let attempt = 1;
        while (attempt <= maxAttempts) {
            try {
                return await fn();
            } catch (error) {
                if (attempt === maxAttempts) {
                    Logger.error(`${operationName} failed after ${maxAttempts} attempts.`);
                    throw error;
                }

                Logger.warn(`${operationName} failed (Attempt ${attempt}/${maxAttempts}). Retrying in ${delayMs}ms... Error: ${error.message}`);
                await new Promise(resolve => setTimeout(resolve, delayMs));

                attempt++;
                delayMs *= 2; // Exponential backoff
            }
        }
    }
}

module.exports = RetryHelper;
