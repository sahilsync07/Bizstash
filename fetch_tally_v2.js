const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const { format, addMonths, startOfMonth, endOfMonth, isAfter, parseISO } = require('date-fns');

const TALLY_URL = 'http://localhost:9000';

// Note: DATA_DIR is now derived in main/fetchAll

async function fetchFromTally(tdl) {
    try {
        const response = await axios.post(TALLY_URL, tdl, {
            headers: { 'Content-Type': 'text/xml' }
        });
        return response.data;
    } catch (error) {
        console.error('Network Error fetching from Tally:', error.message);
        throw error;
    }
}

async function fetchMasters(dirs) {
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

    const filePath = path.join(dirs.masters, 'masters.xml');
    await fs.writeFile(filePath, data);
    console.log(`Masters saved to ${filePath}`);
}

async function fetchVouchers(dirs) {
    console.log('Fetching Vouchers (Full Range)...');

    // Expanded Range based on user input (up to 2026)
    // Starting back from 2023 just to be safe, or 2024 as verified.
    // User mentioned screenshot data is Apr 2025 to Nov 2025. 
    // We will cover 2024-04-01 to 2026-03-31 to be comprehensive.

    let currentDate = parseISO('2024-04-01');
    const endDate = parseISO('2026-03-31');

    while (!isAfter(currentDate, endDate)) {
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
                        <REPORTNAME>Voucher Register</REPORTNAME>
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
            } else if (!data.includes('<VOUCHER')) {
                console.log(`No vouchers found for ${fromDateStr}-${toDateStr}.`);
            } else {
                const filename = `vouchers_${fromDateStr}_to_${toDateStr}.xml`;
                const filePath = path.join(dirs.vouchers, filename);
                await fs.writeFile(filePath, data);
                console.log(`  Saved ${filename} (Size: ${data.length} bytes)`);
            }
        }

        currentDate = addMonths(currentDate, 1);
        await new Promise(r => setTimeout(r, 50)); // Fast fetch
    }
    console.log('Voucher fetch complete.');
}

async function main(companyName) {
    console.log('Starting Tally Data Sync (Smart V3)...');

    // Default to 'default' folder if no company provided, to preserve old behavior or generic use
    // Using 'xml' as default folder to maintain backward compatibility with 'tally_data/xml'
    const targetFolder = companyName && companyName !== 'default_company' ?
        path.join('xml', companyName) : // e.g. tally_data/xml/SBE_Rayagada 
        'xml';                           // e.g. tally_data/xml (root)

    // Wait, previously XML_DIR was tally_data/xml.
    // If I use 'xml/SBE_Rayagada', the full path is tally_data/xml/SBE_Rayagada.
    // That seems cleaner than tally_data/SBE_Rayagada?
    // Let's stick to tally_data/xml/SBE_Rayagada to keep "xml" grouping.

    // Actually, 'tally_data/xml' was the root.
    // If I make specific folders, they should probably be siblings or children.
    // tally_data/xml/SBE_Rayagada vs tally_data/xml_SBE_Rayagada?
    // Let's use tally_data/xml/SBE_Rayagada.

    // Logic:
    // If companyName is provided: tally_data/xml/{companyName}
    // If NOT provided: tally_data/xml (backward compatibility)

    let relativePath = 'xml';
    if (companyName && companyName !== 'default_company') {
        // If the company name is passed, we create a subfolder inside xml
        // BUT wait, existing structure is tally_data/xml containing vouchers/masters.
        // If we make tally_data/xml/SBE_Rayagada, it will contain vouchers/masters.
        relativePath = path.join('xml', companyName);
    }

    // But wait, the previous code used `tally_data/xml` directly.
    // If I change the default behavior, I might break other things.
    // So if no companyName, stick to `xml`.

    const DATA_DIR = path.join(__dirname, 'tally_data', relativePath);
    const MASTERS_DIR = path.join(DATA_DIR, 'masters');
    const VOUCHERS_DIR = path.join(DATA_DIR, 'vouchers');

    const dirs = { masters: MASTERS_DIR, vouchers: VOUCHERS_DIR };

    console.log(`[Sync] Target Data Directory: ${DATA_DIR}`);

    // Ensure directories exist everytime main is called
    fs.ensureDirSync(MASTERS_DIR);
    fs.ensureDirSync(VOUCHERS_DIR);

    if (!fs.existsSync(path.join(MASTERS_DIR, 'masters.xml'))) {
        await fetchMasters(dirs);
    } else {
        console.log("Masters already exist, verifying connection...");
        // Re-fetch Masters to ensure sync
        await fetchMasters(dirs);
    }
    await fetchVouchers(dirs);
    console.log('Sync process finished.');
}

if (require.main === module) {
    // If run directly, take arg
    const company = process.argv[2];
    main(company).catch(console.error);
}

module.exports = { fetchAll: main };
