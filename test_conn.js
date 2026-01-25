const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

const TALLY_URL = 'http://localhost:9000';

async function fetchTally(tdl) {
    try {
        const response = await axios.post(TALLY_URL, tdl, {
            headers: { 'Content-Type': 'text/xml' }
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching from Tally:', error.message);
        return null;
    }
}

async function getCompanyInfo() {
    const tdl = `
    <ENVELOPE>
        <HEADER>
            <TALLYREQUEST>Export Data</TALLYREQUEST>
        </HEADER>
        <BODY>
            <EXPORTDATA>
                <REQUESTDESC>
                    <REPORTNAME>List of Companies</REPORTNAME>
                    <STATICVARIABLES>
                        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
                    </STATICVARIABLES>
                </REQUESTDESC>
            </EXPORTDATA>
        </BODY>
    </ENVELOPE>`;

    console.log('Fetching Company Info...');
    const data = await fetchTally(tdl);
    if (data) {
        await fs.ensureDir('tally_data/debug');
        await fs.writeFile('tally_data/debug/company_info.xml', data);
        console.log('Saved company info to tally_data/debug/company_info.xml');
        // Simple regex to extract current company name or date if possible
        // Ideally we use xml2js, but looking at raw first is fine.
        console.log('Sample data:', data.slice(0, 500)); 
    }
}

getCompanyInfo();
