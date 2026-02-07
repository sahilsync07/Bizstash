const fs = require('fs-extra');
const path = require('path');
const { format, addMonths, startOfMonth, endOfMonth, isAfter, parseISO, parse } = require('date-fns');
const CONFIG = require('./config');
const Logger = require('./utils/Logger');
const TallyConnection = require('./TallyConnection');
const TdlBuilder = require('./TdlBuilder');

// V4 Constants
const SYNC_STATE_FILE = 'sync_state.json';

class DataFetcher {
    constructor(companyName) {
        this.companyName = companyName;
        // Resolve Target Directory
        let relativePath = 'xml';
        if (companyName && companyName !== 'default_company') {
            relativePath = path.join('xml', companyName);
        }
        this.baseDir = path.resolve(CONFIG.PATHS.ROOT, 'tally_data', relativePath);
        this.mastersDir = path.join(this.baseDir, 'masters');
        this.vouchersDir = path.join(this.baseDir, 'vouchers'); // Now holds JSON files too
        this.stateFile = path.join(this.baseDir, SYNC_STATE_FILE);
    }

    async init() {
        await fs.ensureDir(this.mastersDir);
        await fs.ensureDir(this.vouchersDir);
        Logger.info(`Data Directory initialized: ${this.baseDir}`);
    }

    async checkConnection() {
        Logger.info('Checking Tally Connection...');
        const xml = TdlBuilder.getCompanyInfo();
        const response = await TallyConnection.send(xml);

        // Parse Company Name (Works for Report or Collection)
        let detectedName = "Unknown";
        // Check for Collection format: <COMPANY ...<NAME>Val</NAME> or just <NAME>Val</NAME>
        const match = response.match(/<NAME[^>]*>(.*?)<\/NAME>/i);
        if (match) detectedName = match[1];

        Logger.success(`Connected to Tally! Active Company: ${detectedName}`);
        return detectedName;
    }

    // --- V4 SMART SYNC ENTRY POINT ---
    async runSmartSync() {
        Logger.header('PHASE 1: SMART FETCH');

        // 1. Check State
        let state = { lastAlterId: 0, lastSync: null };
        try {
            if (fs.existsSync(this.stateFile)) {
                state = await fs.readJson(this.stateFile);
            }
        } catch (e) { }

        if (state.lastAlterId > 0) {
            Logger.info(`Incremental Mode Detected. Last AlterId: ${state.lastAlterId}`);
            await this._runIncrementalSync(state);
        } else {
            Logger.info("No previous sync state found. Running Full Baseline Sync (JSON).");
            await this._runFullSyncJSON(state);
        }
    }

    async _runFullSyncJSON(state) {
        // 1. Fetch Masters (XML) - Hybrid Strategy
        // Resume Logic: Check if masters.xml is fresh (< 2 hours) and large enough
        const mastersPath = path.join(this.mastersDir, 'masters.xml');
        let skipMasters = false;

        try {
            if (fs.existsSync(mastersPath)) {
                const stats = await fs.stat(mastersPath);
                const ageHours = (new Date() - stats.mtime) / (1000 * 60 * 60);
                if (ageHours < 2 && stats.size > 1024 * 1024) { // < 2 hours old and > 1MB
                    skipMasters = true;
                    Logger.info(`Found fresh Masters XML (${(stats.size / 1024 / 1024).toFixed(2)} MB). Skipping fetch.`);
                }
            }
        } catch (e) {
            // Ignore stat errors
        }

        if (!skipMasters) {
            Logger.info('Fetching Masters (XML) [Hybrid Mode]...');
            const mastersXml = TdlBuilder.getMasters(); // Use Legacy XML Request
            const mastersData = await TallyConnection.send(mastersXml);
            await fs.writeFile(mastersPath, mastersData);
            Logger.success('Masters (XML) saved.');
        } else {
            // Just touch the file to keep it fresh? No.
        }

        // 2. Fetch Vouchers (Monthly Batches)
        const cliProgress = require('cli-progress');
        const endDate = new Date();
        const startDate = parseISO('2021-04-01');

        // Progress Bar Logic
        const totalMonths = (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth()) + 1;
        const bar = new cliProgress.SingleBar({
            format: 'Baseline Sync |{bar}| {percentage}% || {value}/{total} Months || {currentMonth}',
            barCompleteChar: '\u2588',
            barIncompleteChar: '\u2591',
            hideCursor: true
        }, cliProgress.Presets.shades_classic);
        bar.start(totalMonths, 0, { currentMonth: "Init" });

        let current = startDate;
        let maxAlterId = 0;

        while (!isAfter(current, endDate)) {
            const rangeStart = startOfMonth(current);
            const rangeEnd = endOfMonth(current);
            if (isAfter(rangeStart, endDate)) break;

            bar.update({ currentMonth: format(rangeStart, 'MMM yyyy') });

            const tdl = TdlBuilder.getVouchersJSON(rangeStart, rangeEnd);
            try {
                const jsonStr = await TallyConnection.send(tdl);

                // Parse to find Max Alter ID
                // Tally JSONEx structure: { ENVELOPE: { BODY: { IMPORTDATA: { REQUESTDATA: { TALLYMESSAGE: [ ... ] } } } } }
                // We need to parse strictly to update state, but save raw string for speed.

                // Simple Regex to find max AlterId might be unsafe if comments exist, but fast.
                // Better: Parse JSON.
                // Note: Tally JSON might be large.

                // To keep it simple: Save the file. We will calculate Max AlterId during PROCESS phase or here?
                // Let's parse here to build valid state. 
                const data = JSON.parse(jsonStr);
                const msgs = data?.ENVELOPE?.BODY?.IMPORTDATA?.REQUESTDATA?.TALLYMESSAGE;

                if (msgs) {
                    const voucherList = Array.isArray(msgs) ? msgs : [msgs];
                    voucherList.forEach(m => {
                        const v = m.VOUCHER;
                        if (v && v.ALTERID) {
                            const aid = parseInt(v.ALTERID);
                            if (aid > maxAlterId) maxAlterId = aid;
                        }
                    });

                    const filename = `vouchers_${format(rangeStart, 'yyyy_MM')}.json`;
                    await fs.writeJson(path.join(this.vouchersDir, filename), voucherList); // Save clean array of messages
                    // await fs.writeFile(path.join(this.vouchersDir, filename), jsonStr); // Save RAW? No, save processed array is better for appending later.
                }

            } catch (e) {
                // Logger.debug(`Error fetching ${format(rangeStart, 'MMM-yy')}: ${e.message}`);
            }

            bar.increment();
            current = addMonths(current, 1);
        }
        bar.stop();

        // Update State
        state.lastAlterId = maxAlterId;
        state.lastSync = new Date().toISOString();
        await fs.writeJson(this.stateFile, state);
        Logger.success(`Baseline Complete. Max AlterId: ${maxAlterId}`);
    }

    async _runIncrementalSync(state) {
        Logger.info(`Fetching updates since AlterId ${state.lastAlterId}...`);

        const tdl = TdlBuilder.getIncrementalVouchers(state.lastAlterId);
        const jsonStr = await TallyConnection.send(tdl);

        let newVouchers = [];
        let maxAlterId = state.lastAlterId;

        try {
            const data = JSON.parse(jsonStr);
            // Tally Collection Export structure is simpler: { ENVELOPE: { BODY: { DATA: { COLLECTION: { VOUCHER: [...] } } } } } ??
            // OR standard export structure if we used Export Data
            // With "Collection", Tally returns: { ENVELOPE: { BODY: { DESC: { ... }, DATA: { COLLECTION: [ ...objects... ] } } } }
            // Let's inspect structure safely

            // Note: If using "Export Data" with Collection Filter, standard structure applies.
            // If using "Collection" request, structure differs.
            // Let's assume standard parsing for now, or robustly find the ARRAY.

            // Generic finder for ARRAY of objects
            // Usually data.ENVELOPE.BODY.DATA.COLLECTION.VOUCHER or just data.ENVELOPE...TALLYMESSAGE

            // For Collection Request:
            const collectionData = data?.ENVELOPE?.BODY?.DATA?.COLLECTION?.VOUCHER;
            if (collectionData) {
                newVouchers = Array.isArray(collectionData) ? collectionData : [collectionData];
            } else {
                // Try standard path (fallback)
                const msgs = data?.ENVELOPE?.BODY?.IMPORTDATA?.REQUESTDATA?.TALLYMESSAGE;
                if (msgs) {
                    newVouchers = (Array.isArray(msgs) ? msgs : [msgs]).map(m => m.VOUCHER).filter(v => v);
                }
            }

        } catch (e) {
            Logger.warn("Failed to parse incremental JSON response. Is it empty?");
            return;
        }

        if (newVouchers.length === 0) {
            Logger.success("No new changes found.");
            return;
        }

        Logger.info(`Found ${newVouchers.length} new/modified vouchers. Merging...`);

        // Update Max AlterId
        newVouchers.forEach(v => {
            const aid = parseInt(v.ALTERID || v.masterId || v.MASTERID || 0); // Varies by export type
            if (aid > maxAlterId) maxAlterId = aid;
        });

        // MERGE LOGIC
        await this._mergeVouchersIntoBatches(newVouchers);

        // Update State
        state.lastAlterId = maxAlterId;
        state.lastSync = new Date().toISOString();
        await fs.writeJson(this.stateFile, state);
        Logger.success(`Incremental Sync Complete. New Max AlterId: ${maxAlterId}`);
    }

    async _mergeVouchersIntoBatches(newVouchers) {
        // 1. Group by YYYY_MM
        const grouped = {};
        newVouchers.forEach(v => {
            const dateStr = v.DATE; // YYYYMMDD
            if (!dateStr) return;
            const yyyy = dateStr.substring(0, 4);
            const mm = dateStr.substring(4, 6);
            const key = `${yyyy}_${mm}`;

            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(v);
        });

        // 2. Open each file and upsert
        for (const [key, vouchers] of Object.entries(grouped)) {
            const filename = `vouchers_${key}.json`;
            const filePath = path.join(this.vouchersDir, filename);

            let existingData = [];
            // If file exists, load it (it's an array of TALLYMESSAGE or VOUCHER objects)
            // Note: Full Sync saved array of TALLYMESSAGE. Incremental returns VOUCHERS.
            // We should normalize storage to VOUCHERS only for simplicity in V4.

            if (fs.existsSync(filePath)) {
                // Determine format
                const raw = await fs.readJson(filePath);
                // Extract vouchers if wrapped in TallyMessage
                if (raw.length > 0 && raw[0].VOUCHER) {
                    existingData = raw.map(m => m.VOUCHER);
                } else {
                    existingData = raw;
                }
            }

            // Create Map for fast lookup by GUID (or MasterID/VoucherNumber+Date)
            const map = new Map();
            existingData.forEach(v => map.set(v.GUID, v));

            // Upsert
            vouchers.forEach(v => {
                map.set(v.GUID, v); // Overwrite existing
            });

            // Convert back to array
            const merged = Array.from(map.values());

            // Save as pure Voucher Array (Cleaner V4 format)
            await fs.writeJson(filePath, merged);
            // Logger.debug(`  Updated ${filename}: ${existingData.length} -> ${merged.length} vouchers`);
        }
    }

    // Legacy support for V3 fetchers
    async fetchMasters() { /* keep V3 logic or redirect? let's keep V3 logic in V3 files if separation needed, or overwrite */
        // For V4, we assume runSmartSync calls the shots.
    }
}

module.exports = DataFetcher;
