const SyncEngine = require('./SyncEngine');
const Logger = require('./utils/Logger');

async function main() {
    const args = process.argv.slice(2);
    const command = args[0];

    // Simple Flag Handling
    if (command === '--health-check') {
        Logger.info("Running Health Check...");
        const TallyConnection = require('./TallyConnection');
        const TdlBuilder = require('./TdlBuilder');
        try {
            const data = await TallyConnection.send(TdlBuilder.getCompanyInfo());
            if (data) Logger.success("Tally is ONLINE and responding.");
            else Logger.error("Tally returned empty response.");
        } catch (e) {
            Logger.error("Health Check Failed", e);
        }
        return;
    }

    // Normal Sync Mode
    const companyName = args[0]; // First regular arg

    const engine = new SyncEngine();
    const success = await engine.run(companyName);

    if (!success) {
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}
