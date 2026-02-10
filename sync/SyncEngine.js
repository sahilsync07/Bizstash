const DataFetcher = require('./DataFetcher');
const DataProcessor = require('./DataProcessor');
const Logger = require('./utils/Logger');

class SyncEngine {
    constructor() {
        Logger.header('BIZSTASH SYNC ENGINE 5.0');
    }

    async run(companyName) {
        if (!companyName) {
            companyName = 'default_company';
            Logger.warn("No company specified, using 'default_company'");
        }

        try {
            const fetcher = new DataFetcher(companyName);
            const processor = new DataProcessor(companyName);
            await fetcher.init();

            // --- PRE-SYNC DASHBOARD ---
            await this._showDashboard(fetcher, companyName);

            // --- FETCH ---
            await fetcher.fetchMasters();
            await fetcher.fetchProfitLoss();
            await fetcher.fetchAllVouchers();

            // --- PROCESS ---
            Logger.header('PHASE 2: PROCESS');
            await processor.process();

            Logger.header('SYNC COMPLETE ✅');
            return true;

        } catch (error) {
            Logger.error('Sync Fatal Error', error);
            return false;
        }
    }

    async _showDashboard(fetcher, companyName) {
        Logger.header('PRE-SYNC DASHBOARD');
        console.log('');

        const info = await fetcher.getPreSyncInfo();

        // Format date string YYYYMMDD → DD-MMM-YYYY
        const fmtDate = (d) => {
            if (!d) return '—';
            const y = d.substring(0, 4), m = d.substring(4, 6), day = d.substring(6, 8);
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            return `${day}-${months[parseInt(m) - 1]}-${y}`;
        };

        const fmtSize = (bytes) => {
            if (!bytes) return '—';
            return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
        };

        const fmtSyncDate = (iso) => {
            if (!iso) return '— (never synced)';
            const d = new Date(iso);
            return d.toLocaleString('en-IN', {
                day: '2-digit', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit', hour12: true
            });
        };

        // Tally Status
        console.log(`  🔗  Tally Status     : ${info.tallyOnline ? '✅ ONLINE' : '❌ OFFLINE'}`);
        console.log(`  🏢  Company          : ${info.companyName}`);
        console.log(`  📅  First Entry      : ${fmtDate(info.startingFrom)}`);
        console.log(`  📅  Last Entry       : ${fmtDate(info.lastVoucherDate)}`);
        console.log(`  📊  Total Vouchers   : ${info.voucherCount > 0 ? info.voucherCount.toLocaleString() : '—'}`);
        console.log(`  🕐  Last Sync        : ${fmtSyncDate(info.lastSyncDate)}`);
        console.log(`  💾  Local Data       : ${info.localDataExists ? `✅ ${fmtSize(info.localVoucherFileSize)}` : '❌ No data'}`);
        console.log(`  📁  Dashboard Output : ${info.dashboardDataExists ? '✅ data.json exists' : '❌ Not generated yet'}`);
        console.log('');

        if (!info.tallyOnline) {
            throw new Error('Tally is not reachable. Please start Tally and try again.');
        }
    }
}

module.exports = SyncEngine;
