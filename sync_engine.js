const fs = require('fs-extra');
const path = require('path');
const { fetchAll } = require('./fetch_tally_v2');
const { processData } = require('./process_tally_v2');

const XML_DIR = path.join(__dirname, 'tally_data', 'xml');
const PROCESSED_DATA_DIR = path.join(__dirname, 'dashboard', 'public', 'data');

async function cleanXmlDirectory() {
    console.log('[Sync Engine] Cleaning previous XML data...');
    try {
        await fs.emptyDir(XML_DIR);
        console.log('[Sync Engine] XML cleanup successful.');
    } catch (err) {
        console.error('[Sync Engine] Error cleaning XML directory:', err);
        throw err;
    }
}

async function verifyDataFetch() {
    console.log('[Sync Engine] Verifying fetched data...');
    if (!fs.existsSync(XML_DIR)) throw new Error('XML Directory missing!');

    // Check for masters
    if (!fs.existsSync(path.join(XML_DIR, 'masters', 'masters.xml'))) {
        throw new Error('Masters XML missing! Fetch likely failed.');
    }

    // Check for at least one voucher file if we expect vouchers
    // It's possible to have 0 vouchers, but usually not. 
    // We can check if the vouchers directory exists.
    const vouchersDir = path.join(XML_DIR, 'vouchers');
    if (!fs.existsSync(vouchersDir)) {
        throw new Error('Vouchers directory missing!');
    }

    const files = await fs.readdir(vouchersDir);
    const xmlFiles = files.filter(f => f.endsWith('.xml'));
    console.log(`[Sync Engine] Found ${xmlFiles.length} voucher files.`);

    // Optional: Check file sizes > 0
    for (const file of xmlFiles) {
        const stat = await fs.stat(path.join(vouchersDir, file));
        if (stat.size === 0) {
            console.warn(`[Sync Engine] Warning: ${file} is empty.`);
        }
    }
}

async function runSync() {
    console.log('==========================================');
    console.log('   BIZSTASH - UNIFIED SYNC ENGINE');
    console.log('==========================================');

    try {
        // 1. Clean old XMLs
        await cleanXmlDirectory();

        // 2. Fetch from Tally
        console.log('[Sync Engine] Starting Data Fetch...');
        // We need to handle connection errors from axios here.
        // fetchAll catches its own errors but returns nothing explicitly on error?
        // Let's check fetch_tally_v2.js. It returns console.error but doesn't throw.
        // We should improve fetch_tally_v2 to throw or return status, but for now
        // we can check if masters.xml is created as a proxy for success.

        await fetchAll();

        // 3. Verify Data
        await verifyDataFetch();

        // 4. Process Data
        console.log('[Sync Engine] Processing Data...');
        const companyName = process.argv[2] || 'default_company';
        await processData(companyName);

        // 5. Clean Up XMLs
        // console.log('[Sync Engine] Cleanup: Deleting XML files...');
        // await fs.emptyDir(XML_DIR);
        // console.log('[Sync Engine] XML files deleted securely.'); // Keep data for debugging until stable

        console.log('==========================================');
        console.log('   SYNC SUCCESSFUL');
        console.log('==========================================');
        process.exit(0);

    } catch (error) {
        console.error('==========================================');
        console.error('   SYNC FAILED');
        console.error('==========================================');
        console.error(error.stack); // Print stack for easier debugging
        process.exit(1);
    }
}

runSync();
