const axios = require('axios');

const TALLY_URL = 'http://localhost:9000';

async function testTdl() {
    console.log("Fetching Company List via Collection...");

    // TDL to fetch Company Collection directly
    const tdl = `
    <ENVELOPE>
        <HEADER>
            <VERSION>1</VERSION>
            <TALLYREQUEST>Export</TALLYREQUEST>
            <TYPE>Collection</TYPE>
            <ID>MyCompanyList</ID>
        </HEADER>
        <BODY>
            <DESC>
                <STATICVARIABLES>
                    <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
                </STATICVARIABLES>
                <TDL>
                    <TDLMESSAGE>
                        <COLLECTION NAME="MyCompanyList">
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
        const response = await axios.post(TALLY_URL, tdl, {
            headers: { 'Content-Type': 'text/xml' }
        });
        console.log("Response Status:", response.status);
        console.log("Response Data:\n", response.data);
    } catch (error) {
        console.error("Error:", error.message);
        if (error.response) {
            console.error("Data:", error.response.data);
        }
    }
}

testTdl();
