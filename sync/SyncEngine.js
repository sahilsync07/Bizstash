const path = require('path');
const fs = require('fs-extra');
const xml2js = require('xml2js');
const { parse, format } = require('date-fns');
const cliProgress = require('cli-progress');
const DataFetcher = require('./DataFetcher');
const DataProcessor = require('./DataProcessor');
const Logger = require('./utils/Logger');
const CONFIG = require('./config');

class SyncEngine {
    constructor() {
        Logger.header('BIZSTASH SYNC ENGINE 7.0 — Delta + Chunk-Parse-Accumulate');
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

            // ════════════════════════════════════════
            // PRE-SYNC DASHBOARD
            // ════════════════════════════════════════
            await this._showDashboard(fetcher, companyName);

            // ════════════════════════════════════════
            // PHASE 1: FETCH MASTERS
            // ════════════════════════════════════════
            Logger.header('PHASE 1: FETCH MASTERS');
            await fetcher.fetchMasters();
            await fetcher.fetchProfitLoss();

            const masters = await processor.parseMastersPublic();
            Logger.success(`Loaded ${Object.keys(masters.ledgers).length} ledgers, ${Object.keys(masters.groups).length} groups.`);

            // ════════════════════════════════════════
            // CHECK FOR DELTA SYNC
            // ════════════════════════════════════════
            const stateFile = fetcher.stateFile;
            let syncState = null;
            try {
                if (await fs.pathExists(stateFile)) {
                    syncState = await fs.readJson(stateFile);
                }
            } catch (e) { }

            const hasPreviousSync = syncState && syncState.maxAlterId && syncState.maxAlterId > 0;
            const dataJsonExists = await fs.pathExists(path.join(CONFIG.PATHS.OUTPUT_DATA, companyName, 'data.json'));

            if (hasPreviousSync && dataJsonExists) {
                // ════════════════════════════════════════
                // DELTA SYNC MODE
                // ════════════════════════════════════════
                return await this._runDeltaSync(fetcher, processor, masters, syncState, stateFile);
            } else {
                // ════════════════════════════════════════
                // FULL SYNC MODE
                // ════════════════════════════════════════
                return await this._runFullSync(fetcher, processor, masters, stateFile);
            }

        } catch (error) {
            Logger.error('Sync Fatal Error', error);
            return false;
        }
    }

    // ════════════════════════════════════════
    // DELTA SYNC — Fetch only changes via ALTERID
    // ════════════════════════════════════════
    async _runDeltaSync(fetcher, processor, masters, syncState, stateFile) {
        Logger.header('PHASE 2: DELTA SYNC (ALTERID)');
        Logger.info(`Previous maxAlterId: ${syncState.maxAlterId}`);

        const xmlParser = new xml2js.Parser({ explicitArray: false, attrkey: '$' });

        // Single request to fetch all changed vouchers
        const rawXml = await fetcher.fetchDeltaVouchers(syncState.maxAlterId);
        const parsed = await xmlParser.parseStringPromise(rawXml);

        let vouchers = parsed?.ENVELOPE?.BODY?.DATA?.COLLECTION?.VOUCHER || [];
        if (!Array.isArray(vouchers)) vouchers = [vouchers];
        vouchers = vouchers.filter(v => v && typeof v === 'object' && v.$);

        if (vouchers.length === 0) {
            Logger.success('✅ No changes detected since last sync. Data is up-to-date!');
            // Update lastSync time even with no changes
            syncState.lastSync = new Date().toISOString();
            await fs.writeJson(stateFile, syncState, { spaces: 2 });
            return true;
        }

        Logger.info(`Found ${vouchers.length} changed/new vouchers.`);

        // Process delta vouchers into transaction objects
        const acc = processor.initAccumulators(masters);
        processor.processVoucherBatch(vouchers, acc, masters);

        // Track max ALTERID from delta batch
        let newMaxAlterId = syncState.maxAlterId;
        acc.allTransactions.forEach(tx => {
            if (tx.alterId > newMaxAlterId) newMaxAlterId = tx.alterId;
        });

        // ════════════════════════════════════════
        // PHASE 3: MERGE & SAVE
        // ════════════════════════════════════════
        Logger.header('PHASE 3: MERGE & SAVE');
        await processor.mergeAndReprocess(acc.allTransactions, masters);

        // Save sync state
        await fs.writeJson(stateFile, {
            lastSync: new Date().toISOString(),
            maxAlterId: newMaxAlterId,
            lastDeltaCount: vouchers.length,
            mode: 'delta'
        }, { spaces: 2 });

        const memUsage = process.memoryUsage();
        Logger.info(`Memory: ${(memUsage.heapUsed / 1024 / 1024).toFixed(0)} MB heap used.`);
        Logger.header('DELTA SYNC COMPLETE ✅');
        Logger.success(`Merged ${vouchers.length} changes. New maxAlterId: ${newMaxAlterId}`);
        return true;
    }

    // ════════════════════════════════════════
    // FULL SYNC — Chunk-parse-accumulate (first run or forced)
    // ════════════════════════════════════════
    async _runFullSync(fetcher, processor, masters, stateFile) {
        Logger.header('PHASE 2: FULL CHUNKED SYNC (7-DAY WEEKS)');

        const info = await fetcher.getPreSyncInfo();
        if (!info.startingFrom || !info.lastVoucherDate) {
            throw new Error("Could not determine company date range for sync.");
        }

        const startDate = parse(info.startingFrom, 'yyyyMMdd', new Date());
        const endDate = parse(info.lastVoucherDate, 'yyyyMMdd', new Date());

        // Build weekly (7-day) chunks
        const chunks = [];
        let cursor = new Date(startDate);
        while (cursor <= endDate) {
            const chunkEnd = new Date(cursor);
            chunkEnd.setDate(chunkEnd.getDate() + 6); // 7-day window
            const actualEnd = chunkEnd > endDate ? endDate : chunkEnd;
            chunks.push({ from: new Date(cursor), to: actualEnd });
            cursor = new Date(actualEnd);
            cursor.setDate(cursor.getDate() + 1);
        }

        Logger.info(`Date range : ${format(startDate, 'dd-MMM-yyyy')} → ${format(endDate, 'dd-MMM-yyyy')}`);
        Logger.info(`Strategy   : ${chunks.length} weekly chunks (7-day windows)`);
        Logger.info(`Estimated  : ~${info.voucherCount || '?'} total vouchers across range`);
        console.log('');

        // Warm-up delay — let Tally breathe after heavy masters/voucher-count queries
        Logger.info('⏳ Giving Tally 3s warm-up before starting chunked fetch...');
        await new Promise(r => setTimeout(r, 3000));

        const acc = processor.initAccumulators(masters);
        let totalVouchersProcessed = 0;
        let maxAlterId = 0;
        let failedChunks = [];
        let chunksWithData = 0;
        let emptyChunks = 0;
        const syncStartTime = Date.now();

        const progressBar = new cliProgress.SingleBar({
            format: ' {bar} | {percentage}% | Week {value}/{total} | {vouchers} vouchers | {status}',
            barCompleteChar: '\u2588',
            barIncompleteChar: '\u2591',
            hideCursor: true
        });
        progressBar.start(chunks.length, 0, { status: 'Starting...', vouchers: 0 });

        const xmlParser = new xml2js.Parser({ explicitArray: false, attrkey: '$' });

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const fromStr = format(chunk.from, 'yyyyMMdd');
            const toStr = format(chunk.to, 'yyyyMMdd');
            const rangeLabel = `${format(chunk.from, 'dd MMM')} – ${format(chunk.to, 'dd MMM')}`;
            const chunkStartMs = Date.now();

            progressBar.update(i, { status: `Fetching ${rangeLabel}...`, vouchers: totalVouchersProcessed });

            try {
                const rawXml = await fetcher.fetchVoucherRange(fromStr, toStr);
                const parsed = await xmlParser.parseStringPromise(rawXml);

                let vouchers = parsed?.ENVELOPE?.BODY?.DATA?.COLLECTION?.VOUCHER || [];
                if (!Array.isArray(vouchers)) vouchers = [vouchers];
                vouchers = vouchers.filter(v => v && typeof v === 'object' && v.$);

                const chunkMs = Date.now() - chunkStartMs;

                if (vouchers.length > 0) {
                    processor.processVoucherBatch(vouchers, acc, masters);
                    totalVouchersProcessed += vouchers.length;
                    chunksWithData++;

                    progressBar.update(i + 1, {
                        status: `✓ ${rangeLabel}: ${vouchers.length} vouchers (${(chunkMs / 1000).toFixed(1)}s)`,
                        vouchers: totalVouchersProcessed
                    });
                } else {
                    emptyChunks++;
                    progressBar.update(i + 1, {
                        status: `· ${rangeLabel}: empty (${chunkMs}ms)`,
                        vouchers: totalVouchersProcessed
                    });
                }

                // Periodic verbose summary every 10 weeks
                if ((i + 1) % 10 === 0) {
                    progressBar.stop();
                    const elapsed = ((Date.now() - syncStartTime) / 1000).toFixed(1);
                    const memMB = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(0);
                    const pct = ((i + 1) / chunks.length * 100).toFixed(0);
                    console.log(`   📊 [${pct}%] ${i + 1}/${chunks.length} weeks | ${totalVouchersProcessed.toLocaleString()} vouchers | ${chunksWithData} active / ${emptyChunks} empty | ${elapsed}s | ${memMB} MB`);
                    progressBar.start(chunks.length, i + 1, {
                        status: 'Continuing...',
                        vouchers: totalVouchersProcessed
                    });
                }

                // Breathing room between requests — critical for Tally stability
                if (i < chunks.length - 1) {
                    await new Promise(r => setTimeout(r, CONFIG.SETTINGS.BATCH_DELAY || 1500));
                }

            } catch (e) {
                const chunkMs = Date.now() - chunkStartMs;
                progressBar.update(i + 1, {
                    status: `✗ ${rangeLabel}: FAILED (${(chunkMs / 1000).toFixed(1)}s)`,
                    vouchers: totalVouchersProcessed
                });
                Logger.warn(`Week ${rangeLabel} failed: ${e.message}`);
                failedChunks.push(rangeLabel);

                // Longer cooldown after a failure before continuing
                Logger.info('   Cooling down 5s before next chunk...');
                await new Promise(r => setTimeout(r, 5000));
            }
        }

        progressBar.update(chunks.length, { status: '✅ All weeks fetched!', vouchers: totalVouchersProcessed });
        progressBar.stop();

        // Track max ALTERID from all transactions
        acc.allTransactions.forEach(tx => {
            if (tx.alterId > maxAlterId) maxAlterId = tx.alterId;
        });

        // ─── VERBOSE FINAL SUMMARY ───
        const totalElapsed = ((Date.now() - syncStartTime) / 1000).toFixed(1);
        const memUsage = process.memoryUsage();
        console.log('');
        console.log('  ┌─────────────────────────────────────────┐');
        console.log('  │          FULL SYNC SUMMARY               │');
        console.log('  ├─────────────────────────────────────────┤');
        console.log(`  │  Weekly Chunks    : ${chunks.length.toString().padStart(8)}           │`);
        console.log(`  │  Weeks with Data  : ${chunksWithData.toString().padStart(8)}           │`);
        console.log(`  │  Empty Weeks      : ${emptyChunks.toString().padStart(8)}           │`);
        console.log(`  │  Failed Weeks     : ${failedChunks.length.toString().padStart(8)}           │`);
        console.log(`  │  Total Vouchers   : ${totalVouchersProcessed.toLocaleString().padStart(8)}           │`);
        console.log(`  │  Max ALTERID      : ${maxAlterId.toString().padStart(8)}           │`);
        console.log(`  │  Elapsed Time     : ${totalElapsed.padStart(7)}s           │`);
        console.log(`  │  Memory Used      : ${(memUsage.heapUsed / 1024 / 1024).toFixed(0).padStart(6)} MB           │`);
        console.log('  └─────────────────────────────────────────┘');
        console.log('');

        if (failedChunks.length > 0) {
            Logger.warn(`⚠ Failed weeks (data may be incomplete): ${failedChunks.join(', ')}`);
        }

        // ════════════════════════════════════════
        // PHASE 3: FINALIZE & SAVE
        // ════════════════════════════════════════
        Logger.header('PHASE 3: FINALIZE & SAVE');
        await processor.finalizeAndSave(acc, masters);

        // Save sync state WITH maxAlterId for future delta syncs
        await fs.writeJson(stateFile, {
            lastSync: new Date().toISOString(),
            maxAlterId,
            vouchersProcessed: totalVouchersProcessed,
            failedChunks,
            mode: 'full'
        }, { spaces: 2 });

        Logger.header('FULL SYNC COMPLETE ✅');
        Logger.success(`Next sync will use delta mode (ALTERID > ${maxAlterId}).`);
        return true;
    }

    async _showDashboard(fetcher, companyName) {
        Logger.header('PRE-SYNC DASHBOARD');
        console.log('');

        const info = await fetcher.getPreSyncInfo();

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

        // Check sync state for delta info
        let syncMode = 'Full (first run)';
        try {
            const stateFile = path.join(fetcher.baseDir, '..', 'sync_state.json');
            if (await fs.pathExists(stateFile)) {
                const state = await fs.readJson(stateFile);
                if (state.maxAlterId > 0) {
                    const dataJsonExists = await fs.pathExists(path.join(CONFIG.PATHS.OUTPUT_DATA, companyName, 'data.json'));
                    syncMode = dataJsonExists ? `⚡ Delta (from ALTERID ${state.maxAlterId})` : 'Full (data.json missing)';
                }
            }
        } catch (e) { }

        console.log(`  🔗  Tally Status     : ${info.tallyOnline ? '✅ ONLINE' : '❌ OFFLINE'}`);
        console.log(`  🏢  Company          : ${info.companyName}`);
        console.log(`  📅  First Entry      : ${fmtDate(info.startingFrom)}`);
        console.log(`  📅  Last Entry       : ${fmtDate(info.lastVoucherDate)}`);
        console.log(`  📊  Total Vouchers   : ${info.voucherCount > 0 ? info.voucherCount.toLocaleString() : '—'}`);
        console.log(`  🕐  Last Sync        : ${fmtSyncDate(info.lastSyncDate)}`);
        console.log(`  💾  Local Data       : ${info.localDataExists ? `✅ ${fmtSize(info.localVoucherFileSize)}` : '❌ No data'}`);
        console.log(`  📁  Dashboard Output : ${info.dashboardDataExists ? '✅ data.json exists' : '❌ Not generated yet'}`);
        console.log(`  🔄  Sync Mode        : ${syncMode}`);
        console.log('');

        if (!info.tallyOnline) {
            throw new Error('Tally is not reachable. Please start Tally and try again.');
        }
    }
}

module.exports = SyncEngine;
