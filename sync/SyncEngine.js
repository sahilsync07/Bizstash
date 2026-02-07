const DataFetcher = require('./DataFetcher');
const DataProcessor = require('./DataProcessor');
const Logger = require('./utils/Logger');

class SyncEngine {
    constructor() {
        Logger.header('BIZSTASH SYNC ENGINE 3.0');
    }

    async run(companyName) {
        // Fallback or Validation
        if (!companyName) {
            companyName = 'default_company';
            Logger.warn("No company specified, using 'default_company'");
        }

        Logger.info(`Target Company: ${companyName}`);

        try {
            // 1. Initialize Components
            const fetcher = new DataFetcher(companyName);
            const processor = new DataProcessor(companyName);

            // 2. Health Check
            // We do a ping first to fail fast if Tally isn't running
            const detectedName = await fetcher.checkConnection();

            // Optional: Check if detected company matches requested (for safety)
            // But we often map folder names differently than Tally names, so just logging for now.
            if (detectedName.toUpperCase() !== companyName.replace(/_/g, ' ').toUpperCase()) {
                Logger.debug(`Note: Tally Company "${detectedName}" differs from Folder ID "${companyName}"`);
            }

            // 3. Prepare Directories
            await fetcher.init();

            // 3. FETCH PHASE
            await fetcher.runSmartSync(); // V4 Smart Logic

            // 4. PROCESS PHASE
            Logger.header('PHASE 2: PROCESS');
            await processor.process();

            Logger.header('SYNC COMPLETE');
            return true;

        } catch (error) {
            Logger.error('Sync Fatal Error', error);
            return false;
        }
    }
}

module.exports = SyncEngine;
