const fs = require('fs-extra');
const path = require('path');
const CONFIG = require('./config');
const Logger = require('./utils/Logger');
const TallyConnection = require('./TallyConnection');
const TdlBuilder = require('./TdlBuilder');

class DataFetcher {
    constructor(companyName) {
        this.companyName = companyName;
        let relativePath = 'xml';
        if (companyName && companyName !== 'default_company') {
            relativePath = path.join('xml', companyName);
        }
        this.baseDir = path.resolve(CONFIG.PATHS.ROOT, 'tally_data', relativePath);
        this.mastersDir = path.join(this.baseDir, 'masters');
        this.vouchersDir = path.join(this.baseDir, 'vouchers');
        this.stateFile = path.join(this.baseDir, 'sync_state.json');
    }

    async init() {
        await fs.ensureDir(this.mastersDir);
        await fs.ensureDir(this.vouchersDir);
        Logger.info(`Data Directory: ${this.baseDir}`);
    }

    // --- PRE-SYNC DASHBOARD ---
    async getPreSyncInfo() {
        const info = {
            tallyOnline: false,
            companyName: 'Unknown',
            startingFrom: null,
            lastVoucherDate: null,
            voucherCount: 0,
            lastSyncDate: null,
            localDataExists: false,
            localVoucherFileSize: null,
            dashboardDataExists: false,
        };

        // 1. Check Tally connection + get company stats
        try {
            const statsXml = await TallyConnection.send(TdlBuilder.getCompanyStats());
            info.tallyOnline = true;

            // If multiple companies are open, find the one that matches <CURRENTCOMPANY>
            const companyBlocks = statsXml.match(/<COMPANY[^>]*>[\s\S]*?<\/COMPANY>/g) || [];
            let activeBlock = companyBlocks[0] || statsXml;

            const globalCurrentMatch = statsXml.match(/<CURRENTCOMPANY[^>]*>([^<]+)<\/CURRENTCOMPANY>/i);
            if (globalCurrentMatch) {
                const targetName = globalCurrentMatch[1].trim().toUpperCase();
                const found = companyBlocks.find(block => {
                    const nameMatch = block.match(/<NAME[^>]*>([^<]+)<\/NAME>/i);
                    return nameMatch && nameMatch[1].trim().toUpperCase() === targetName;
                });
                if (found) activeBlock = found;
            }

            // Parse company name from active block
            const nameMatch = activeBlock.match(/<NAME[^>]*>([^<]+)<\/NAME>/i);
            if (nameMatch) info.companyName = nameMatch[1];

            // Parse StartingFrom
            const startMatch = activeBlock.match(/<STARTINGFROM[^>]*>([^<]+)<\/STARTINGFROM>/i);
            if (startMatch) info.startingFrom = startMatch[1];

            // Parse BooksFrom
            const booksMatch = activeBlock.match(/<BOOKSFROM[^>]*>([^<]+)<\/BOOKSFROM>/i);
            if (booksMatch && !info.startingFrom) info.startingFrom = booksMatch[1];

            // Parse LastVoucherDate
            const lastMatch = activeBlock.match(/<LASTVOUCHERDATE[^>]*>([^<]+)<\/LASTVOUCHERDATE>/i);
            if (lastMatch) info.lastVoucherDate = lastMatch[1];
        } catch (e) {
            info.tallyOnline = false;
        }

        // 2. Count vouchers (if Tally is online)
        if (info.tallyOnline) {
            try {
                const countXml = await TallyConnection.send(TdlBuilder.getVoucherCount());
                // Count VOUCHER tags
                const matches = countXml.match(/<VOUCHER /g);
                info.voucherCount = matches ? matches.length : 0;
            } catch (e) {
                // Non-critical, continue
            }
        }

        // 3. Check local state
        try {
            if (fs.existsSync(this.stateFile)) {
                const state = await fs.readJson(this.stateFile);
                info.lastSyncDate = state.lastSync || null;
            }
        } catch (e) { }

        // 4. Check local vouchers.xml
        const vouchersFile = path.join(this.vouchersDir, 'vouchers.xml');
        if (fs.existsSync(vouchersFile)) {
            const stats = await fs.stat(vouchersFile);
            info.localDataExists = true;
            info.localVoucherFileSize = stats.size;
        }

        // 5. Check dashboard output
        const dashboardFile = path.join(CONFIG.PATHS.OUTPUT_DATA, this.companyName, 'data.json');
        info.dashboardDataExists = fs.existsSync(dashboardFile);

        return info;
    }

    // --- RANGE FETCH ---
    async fetchVoucherRange(fromDate, toDate) {
        try {
            return await TallyConnection.send(TdlBuilder.getAllVouchers(fromDate, toDate));
        } catch (e) {
            Logger.debug(`Range Fetch Failed [${fromDate} - ${toDate}]: ${e.message}`);
            throw e;
        }
    }

    // --- DELTA FETCH (only changes since last sync) ---
    async fetchDeltaVouchers(minAlterId) {
        try {
            Logger.info(`Fetching delta vouchers (ALTERID > ${minAlterId})...`);
            return await TallyConnection.send(TdlBuilder.getDeltaVouchers(minAlterId));
        } catch (e) {
            Logger.debug(`Delta Fetch Failed: ${e.message}`);
            throw e;
        }
    }

    /** Get the active company name from Tally. */
    async getCompanyName() {
        const info = await this.getPreSyncInfo();
        return info.companyName;
    }
    // --- MASTERS FETCH ---
    async fetchMasters() {
        Logger.info('Fetching Masters (Groups & Ledgers)...');

        try {
            // 1. Fetch Groups
            const groupsXml = await TallyConnection.send(TdlBuilder.getGroups());
            await fs.writeFile(path.join(this.mastersDir, 'groups.xml'), groupsXml);

            // 2. Fetch Ledgers
            const ledgersXml = await TallyConnection.send(TdlBuilder.getLedgers());
            await fs.writeFile(path.join(this.mastersDir, 'ledgers.xml'), ledgersXml);

            Logger.success('Fetched Masters successfully.');

        } catch (e) {
            Logger.error('Failed to fetch Masters', e);
            throw e;
        }
    }


    // --- PROFIT & LOSS FETCH ---
    async fetchProfitLoss() {
        Logger.info('Fetching Profit & Loss Report...');
        try {
            const xml = await TallyConnection.send(TdlBuilder.getProfitLossRequest());
            await fs.writeFile(path.join(this.mastersDir, 'profit_loss.xml'), xml);
            Logger.success('Fetched Profit & Loss successfully.');
        } catch (e) {
            Logger.error('Failed to fetch Profit & Loss', e);
        }
    }
}

module.exports = DataFetcher;
