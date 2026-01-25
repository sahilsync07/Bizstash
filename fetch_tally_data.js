const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const { format, addMonths, startOfMonth, endOfMonth, isAfter, parseISO } = require('date-fns');

const TALLY_URL = 'http://localhost:9000';
const DATA_DIR = path.join(__dirname, 'tally_data', 'xml');
const MASTERS_DIR = path.join(DATA_DIR, 'masters');
const VOUCHERS_DIR = path.join(DATA_DIR, 'vouchers');

// Ensure directories exist
fs.ensureDirSync(MASTERS_DIR);
fs.ensureDirSync(VOUCHERS_DIR);

async function fetchFromTally(tdl) {
    try {
        const response = await axios.post(TALLY_URL, tdl, {
            headers: { 'Content-Type': 'text/xml' }
        });
        return response.data;
    } catch (error) {
        console.error('Network Error fetching from Tally:', error.message);
        return null;
    }
}

function calculateChecksum(data) {
    return crypto.createHash('md5').update(data).digest('hex');
}

async function fetchMasters() {
    console.log('Fetching Masters...');
    const tdl = `
    <ENVELOPE>
        <HEADER>
            <TALLYREQUEST>Export Data</TALLYREQUEST>
        </HEADER>
        <BODY>
            <EXPORTDATA>
                <REQUESTDESC>
                    <REPORTNAME>List of Accounts</REPORTNAME>
                    <STATICVARIABLES>
                        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
                        <ACCOUNTTYPE>All Masters</ACCOUNTTYPE>
                    </STATICVARIABLES>
                </REQUESTDESC>
            </EXPORTDATA>
        </BODY>
    </ENVELOPE>`;

    const data = await fetchFromTally(tdl);
    if (!data) return;

    if (data.includes('<LINEERROR>')) {
        console.error('Error fetching Masters:', data);
        return;
    }

    const filePath = path.join(MASTERS_DIR, 'masters.xml');

    // Checksum logic
    let oldChecksum = '';
    if (fs.existsSync(filePath)) {
        const oldData = fs.readFileSync(filePath);
        oldChecksum = calculateChecksum(oldData);
    }
    const newChecksum = calculateChecksum(data);

    if (oldChecksum === newChecksum) {
        console.log('Masters: No changes detected. Skipping write.');
    } else {
        await fs.writeFile(filePath, data);
        console.log(`Masters saved to ${filePath} (Checksum: ${newChecksum})`);
    }
}

async function fetchVouchers() {
    console.log('Fetching Vouchers...');
    // Start from April 1, 2020 (Hardcoded for now, can be dynamic)
    let currentDate = parseISO('2020-04-01');
    const now = new Date();

    while (!isAfter(currentDate, now)) {
        const fromDateStr = format(startOfMonth(currentDate), 'yyyyMMdd');
        const toDateStr = format(endOfMonth(currentDate), 'yyyyMMdd');

        console.log(`Fetching Vouchers for range: ${fromDateStr} to ${toDateStr}`);

        const tdl = `
        <ENVELOPE>
            <HEADER>
                <TALLYREQUEST>Export Data</TALLYREQUEST>
            </HEADER>
            <BODY>
                <EXPORTDATA>
                    <REQUESTDESC>
                        <REPORTNAME>Day Book</REPORTNAME>
                        <STATICVARIABLES>
                            <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
                            <SVFROMDATE>${fromDateStr}</SVFROMDATE>
                            <SVTODATE>${toDateStr}</SVTODATE>
                        </STATICVARIABLES>
                    </REQUESTDESC>
                </EXPORTDATA>
            </BODY>
        </ENVELOPE>`;

        const data = await fetchFromTally(tdl);
        if (data) {
            if (data.includes('<LINEERROR>')) {
                console.warn(`Warning for range ${fromDateStr}-${toDateStr}:`, data);
            } else if (data.length < 500 && !data.includes('VOUCHER')) {
                // Might be empty envelope
                console.log(`No vouchers found for ${fromDateStr}-${toDateStr} (or empty response).`);
            } else {
                const filename = `vouchers_${fromDateStr}_to_${toDateStr}.xml`;
                const filePath = path.join(VOUCHERS_DIR, filename);

                let oldChecksum = '';
                if (fs.existsSync(filePath)) {
                    oldChecksum = calculateChecksum(fs.readFileSync(filePath));
                }
                const newChecksum = calculateChecksum(data);

                if (oldChecksum === newChecksum) {
                    console.log(`  Retrieving ${filename}: No change.`);
                } else {
                    await fs.writeFile(filePath, data);
                    console.log(`  Saved ${filename} (Size: ${data.length} bytes)`);
                }
            }
        }

        // Move to next month
        currentDate = addMonths(currentDate, 1);
        // Small delay to be polite to localhost Tally
        await new Promise(r => setTimeout(r, 100));
    }
    console.log('Voucher fetch complete.');
}

async function main() {
    console.log('Starting Tally Data Sync...');
    await fetchMasters();
    await fetchVouchers();
    console.log('Sync process finished.');
}

main().catch(console.error);
