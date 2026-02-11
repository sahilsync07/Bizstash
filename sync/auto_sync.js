const SyncEngine = require('./SyncEngine');
const TallyConnection = require('./TallyConnection');
const TdlBuilder = require('./TdlBuilder');
const CONFIG = require('./config');
const Logger = require('./utils/Logger');
const CompanyRegistry = require('./utils/CompanyRegistry');

/**
 * Sanitizes a Tally name into a clean folder ID
 */
function generateId(fullname) {
    // 1. Remove track info like "(2024-25)"
    let clean = fullname.replace(/\(.*\)/g, '').trim();
    // 2. Remove "M/S" only (keep SHREE/SRI as they are distinctive)
    clean = clean.replace(/^(M\/S|M\/s|Ms)\.?\s*/i, '').trim();
    // 3. Keep only alphanumeric and spaces, then replace spaces with underscores
    return clean.replace(/[^a-zA-Z0-9\s]/g, '')
        .replace(/\s+/g, '_')
        .toUpperCase();
}

async function autoSync() {
    Logger.header('BIZSTASH DYNAMIC AUTO-SYNC');

    let tallyName = 'Unknown';
    try {
        const infoXml = await TallyConnection.send(TdlBuilder.getCompanyInfo());
        // Look for the computed CurrentCompany tag which always holds the ACTIVE context
        const nameMatch = infoXml.match(/<CURRENTCOMPANY[^>]*>([^<]+)<\/CURRENTCOMPANY>/i);

        if (nameMatch) {
            tallyName = nameMatch[1];
        } else {
            // Fallback to name if only one exists or if computed field failed
            const simpleMatch = infoXml.match(/<NAME[^>]*>([^<]+)<\/NAME>/i);
            tallyName = simpleMatch ? simpleMatch[1] : 'Unknown';
        }
    } catch (e) {
        Logger.error("Tally is OFFLINE. Please start Tally and open the company.");
        process.exit(1);
    }

    Logger.info(`Detected Tally Company: "${tallyName}"`);

    // 1. Check if it's explicitly mapped in config.js (legacy support)
    let detectedId = null;
    const normalizedTally = tallyName.toUpperCase();

    for (const [id, targetName] of Object.entries(CONFIG.TALLY_COMPANY_MAP)) {
        if (normalizedTally.includes(targetName.toUpperCase())) {
            detectedId = id;
            break;
        }
    }

    // 2. Check existing companies.json to prevent duplicates
    if (!detectedId) {
        const companies = await CompanyRegistry.getCompanies();
        const match = companies.find(c => normalizedTally.includes(c.name.toUpperCase()) || c.name.toUpperCase().includes(normalizedTally));
        if (match) {
            detectedId = match.id;
            Logger.info(`Found existing registration: ${detectedId}`);
        }
    }

    // 3. If not found, generate a dynamic ID
    if (!detectedId) {
        detectedId = generateId(tallyName);
        Logger.info(`Generated Dynamic ID: ${detectedId}`);
    }

    if (detectedId) {
        Logger.success(`Ready to sync to project: ${detectedId}`);
        const engine = new SyncEngine();
        const success = await engine.run(detectedId);

        if (success) {
            // Register in companies.json for dashboard dropdown
            await CompanyRegistry.register(detectedId, tallyName);
            Logger.success("Auto-Sync Complete.");
        } else {
            process.exit(1);
        }
    }
}

autoSync();
