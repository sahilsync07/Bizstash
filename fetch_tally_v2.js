const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const { format, addMonths, startOfMonth, endOfMonth, isAfter, parseISO, parse } = require('date-fns');

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

async function fetchCompanyRange() {
    console.log('Detecting Company Date Range from Tally via Collection (Building Block 1.a Logic)...');

    // METHOD: Export Collection of Type 'Company' (Matches 1.a-runner.bat)
    const tdl = `
    <ENVELOPE>
        <HEADER>
            <VERSION>1</VERSION>
            <TALLYREQUEST>Export</TALLYREQUEST>
            <TYPE>Collection</TYPE>
            <ID>BizStashCompanyStats</ID>
        </HEADER>
        <BODY>
            <DESC>
                <STATICVARIABLES>
                    <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
                </STATICVARIABLES>
                <TDL>
                    <TDLMESSAGE>
                        <COLLECTION NAME="BizStashCompanyStats">
                            <TYPE>Company</TYPE>
                            <FETCH>Name, BooksFrom, LastVoucherDate</FETCH>
                            <COMPUTE>VoucherCount: $$NumItems:Voucher</COMPUTE>
                        </COLLECTION>
                    </TDLMESSAGE>
                </TDL>
            </DESC>
        </BODY>
    </ENVELOPE>`;

    try {
        const data = await fetchFromTally(tdl);
        if (!data) throw new Error("No response from Tally");

        // ROBUST PARSING: First isolate the COMPANY block
        // This avoids matching <NAME> tags in Header/RequestDesc which caused issues before
        const companyBlockMatch = data.match(/<COMPANY[^>]*>([\s\S]*?)<\/COMPANY>/i);

        if (!companyBlockMatch) {
            console.warn("No <COMPANY> block found in response.");
            // If Tally returns vouchers instead of company (weird case), log it.
            if (data.includes('<VOUCHER>')) console.warn("Received VOUCHER data instead of COMPANY data!");

            throw new Error("Invalid Tally Response: No Company Data");
        }

        const companyData = companyBlockMatch[1];

        // Now extract fields from the isolated block
        const nameMatch = companyData.match(/<NAME[^>]*>([^<]+)<\/NAME>/i);
        const startMatch = companyData.match(/<BOOKSFROM[^>]*>([^<]+)<\/BOOKSFROM>/i);
        const endMatch = companyData.match(/<LASTVOUCHERDATE[^>]*>([^<]+)<\/LASTVOUCHERDATE>/i);
        const countMatch = companyData.match(/<VOUCHERCOUNT[^>]*>([^<]+)<\/VOUCHERCOUNT>/i);

        let startStr = startMatch ? startMatch[1] : null;
        let endStr = endMatch ? endMatch[1] : null;
        let totalVouchers = countMatch ? parseInt(countMatch[1]) : 0;
        let companyNameDetected = nameMatch ? nameMatch[1] : "Unknown";

        console.log(`[Tally] Connected Company: ${companyNameDetected}`);

        if (!startStr) {
            console.warn("Could not detect Start Date (BooksFrom). Defaulting.");
            startStr = "20240401";
        }

        // If LastVoucherDate is missing, it might mean 0 vouchers or Tally version issue.
        // Fallback to today if missing.
        if (!endStr) {
            console.warn("Could not detect LastVoucherDate. Defaulting to Today.");
            endStr = format(new Date(), 'yyyyMMdd');
        }

        console.log(`Company Range Detected: ${startStr} to ${endStr}. Total Vouchers: ${totalVouchers}`);
        return {
            start: parse(startStr, 'yyyyMMdd', new Date()),
            end: endStr ? parse(endStr, 'yyyyMMdd', new Date()) : new Date(),
            totalVouchers: totalVouchers
        };

    } catch (e) {
        console.error("Failed to detect company range via Collection.", e.message);
        return { start: parseISO('2024-04-01'), end: new Date(), totalVouchers: 0 };
    }
}


async function fetchVoucherStats(startDate, endDate) {
    console.log('Fetching Voucher Statistics (Checksum) from Tally...');
    const fromStr = format(startDate, 'yyyyMMdd');
    const toStr = format(endDate, 'yyyyMMdd');

    // METHOD 2: Use Built-in "Statistics" Report
    // This removes the risk of my Custom Collection being defined wrongly.
    // The report name in Tally is "Statistics"
    const tdl = `
    <ENVELOPE>
        <HEADER>
            <TALLYREQUEST>Export Data</TALLYREQUEST>
        </HEADER>
        <BODY>
            <EXPORTDATA>
                <REQUESTDESC>
                    <REPORTNAME>Statistics</REPORTNAME>
                    <STATICVARIABLES>
                        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
                        <SVFROMDATE>${fromStr}</SVFROMDATE>
                        <SVTODATE>${toStr}</SVTODATE>
                    </STATICVARIABLES>
                </REQUESTDESC>
            </EXPORTDATA>
        </BODY>
    </ENVELOPE>`;

    try {
        const data = await fetchFromTally(tdl);
        if (!data) return {};

        const stats = {};

        // The built-in Statistics report output structure:
        // <VOUCHERTYPE> 
        //    <NAME>Sales</NAME> 
        //    <TOTALVOUCHERS>123</TOTALVOUCHERS> 
        //    ...
        // </VOUCHERTYPE>

        // Use a persistent regex loop
        const regex = /<VOUCHERTYPE>[\s\S]*?<NAME>(.*?)<\/NAME>[\s\S]*?<TOTALVOUCHERS>(.*?)<\/TOTALVOUCHERS>[\s\S]*?<\/VOUCHERTYPE>/gi;
        let match;
        while ((match = regex.exec(data)) !== null) {
            const name = match[1];
            const countStr = match[2];
            const count = parseInt(countStr.replace(/,/g, '') || '0');
            if (count > 0) stats[name] = count;
        }

        // If Regex failed (structure might vary), try simple tag matching
        if (Object.keys(stats).length === 0) {
            const nameMatches = [...data.matchAll(/<NAME>(.*?)<\/NAME>/gi)];
            const totalMatches = [...data.matchAll(/<TOTALVOUCHERS>(.*?)<\/TOTALVOUCHERS>/gi)];
            // Use the smaller length to be safe
            nameMatches.forEach((m, i) => {
                if (totalMatches[i]) {
                    const cnt = parseInt(totalMatches[i][1].replace(/,/g, '') || '0');
                    if (cnt > 0) stats[m[1]] = cnt;
                }
            });
        }

        return stats;
    } catch (e) {
        console.error("Failed to fetch statistics for checksum:", e.message);
        return {};
    }
}

async function fetchVouchers(dirs) {
    console.log('Fetching Vouchers...');

    // 1. Dynamic Range Detection
    const range = await fetchCompanyRange();

    // Default Fallbacks if detection fails
    // Fallback: Start from 2021 if cannot detect, End at Today
    let currentDate = range?.start || parseISO('2021-04-01');
    const endDate = range?.end || new Date(); // Default to today/now

    // Sanity: If Tally returns empty end date (no vouchers?), use Today
    if (!range?.end) console.log("Last voucher date not found, fetching up to today.");

    console.log(`Syncing Period: ${format(currentDate, 'dd-MM-yyyy')} to ${format(endDate, 'dd-MM-yyyy')}`);

    // Verification Counters
    const downloadedCounts = {};
    let totalDownloaded = 0;

    // Initial Verification Check
    if (range && range.totalVouchers > 0) {
        console.log(`[Verification] Tally reports ${range.totalVouchers} total vouchers. Fetching...`);
    }

    while (!isAfter(currentDate, endDate)) {
        const fromDateStr = format(startOfMonth(currentDate), 'yyyyMMdd');
        const toDateStr = format(endOfMonth(currentDate), 'yyyyMMdd');

        // Optimization: Don't fetch future months if end date is in current month
        // But our while loop condition handles isAfter(currentDate, endDate)
        // We just need to ensure we don't request 'future' beyond standard bounds if endDate is Today.

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

                // -- CHECKSUM LOGIC --
                // Count vouchers in this batch
                const typeMatches = [...data.matchAll(/<VOUCHERTYPENAME>(.*?)<\/VOUCHERTYPENAME>/g)];
                typeMatches.forEach(m => {
                    const type = m[1];
                    downloadedCounts[type] = (downloadedCounts[type] || 0) + 1;
                    totalDownloaded++;
                });
            }
        }

        currentDate = addMonths(currentDate, 1);
        await new Promise(r => setTimeout(r, 50)); // Fast fetch
    }
    console.log('Voucher fetch complete.');

    // --- VERIFICATION REPORT ---
    console.log('\n--- DATA VERIFICATION REPORT ---');
    const tallyStats = await fetchVoucherStats(range?.start || parseISO('2021-04-01'), endDate);

    let allMatch = true;
    console.log(`${'Voucher Type'.padEnd(25)} | ${'Tally (Source)'.padEnd(15)} | ${'Downloaded'.padEnd(15)} | ${'Status'}`);
    console.log('-'.repeat(70));

    // Combine keys
    const allTypes = new Set([...Object.keys(downloadedCounts), ...Object.keys(tallyStats)]);

    allTypes.forEach(type => {
        const source = tallyStats[type] || 0;
        const downloaded = downloadedCounts[type] || 0;
        const match = source === downloaded;
        if (!match) allMatch = false;

        const status = match ? '✅ MATCH' : '❌ MISMATCH';
        if (source > 0 || downloaded > 0) { // Only show active types
            console.log(`${type.padEnd(25)} | ${source.toString().padEnd(15)} | ${downloaded.toString().padEnd(15)} | ${status}`);
        }
    });
    console.log('-'.repeat(70));

    // Total Count Verification
    if (range && range.totalVouchers !== undefined) {
        if (totalDownloaded === range.totalVouchers) {
            console.log(`[TOTAL CHECK] SUCCESS: Downloaded ${totalDownloaded} / ${range.totalVouchers} vouchers.`);
        } else {
            console.warn(`[TOTAL CHECK] MISMATCH: Downloaded ${totalDownloaded} but Tally reported ${range.totalVouchers}.`);
            allMatch = false;
        }
    }

    if (allMatch) {
        console.log('SUCCESS: All data fetched correctly with 100% integrity.');
    } else {
        console.warn('WARNING: Data Mismatch detected! Some vouchers might be missing or out of sync.');
    }
    console.log('--------------------------------\n');
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

module.exports = { fetchAll: main, fetchCompanyRange };
