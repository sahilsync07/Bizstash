const TallyConnection = require('./sync/TallyConnection');

const getRegisterTDL = (registerType) => {
    return `
<HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export Data</TALLYREQUEST>
</HEADER>
<BODY>
    <EXPORTDATA>
        <REQUESTDESC>
            <REPORTNAME>Monthly Summary</REPORTNAME>
            <STATICVARIABLES>
                <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
                <SVFROMDATE>20251101</SVFROMDATE>
                <SVTODATE>20251130</SVTODATE>
                <EXPLODEFLAG>Yes</EXPLODEFLAG>
                <TYPEOFVOUCHERS>${registerType}</TYPEOFVOUCHERS>
            </STATICVARIABLES>
        </REQUESTDESC>
    </EXPORTDATA>
</BODY>
    `;
};

const run = async () => {
    try {
        console.log('Fetching Sales Register for Nov 2025...');
        const salesXML = await TallyConnection.send(getRegisterTDL('Sales'));
        console.log('--- SALES REGISTER XML ---');
        console.log(salesXML.substring(0, 500) + '...'); // Log first 500 chars to check structure

        console.log('\nFetching Purchase Register for Nov 2025...');
        const purchaseXML = await TallyConnection.send(getRegisterTDL('Purchase'));
        console.log('--- PURCHASE REGISTER XML ---');
        console.log(purchaseXML.substring(0, 500) + '...');

    } catch (e) {
        console.error('Error:', e);
    }
};

run();
