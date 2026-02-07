const { format } = require('date-fns');

class TdlBuilder {

    // --- LEGACY XML METHODS (Proven V3) ---

    static getCompanyInfo() {
        return `
        <ENVELOPE>
            <HEADER>
                <TALLYREQUEST>Export</TALLYREQUEST>
                <TYPE>Collection</TYPE>
                <ID>SimpleCompanyList</ID>
            </HEADER>
            <BODY>
                <DESC>
                    <STATICVARIABLES>
                        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
                    </STATICVARIABLES>
                    <TDL>
                        <TDLMESSAGE>
                            <COLLECTION NAME="SimpleCompanyList">
                                <TYPE>Company</TYPE>
                                <FETCH>Name, StartingFrom</FETCH>
                            </COLLECTION>
                        </TDLMESSAGE>
                    </TDL>
                </DESC>
            </BODY>
        </ENVELOPE>`;
    }

    static getMasters() {
        return `
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
    }

    static getVouchers(fromDate, toDate) {
        const fromStr = format(fromDate, 'yyyyMMdd');
        const toStr = format(toDate, 'yyyyMMdd');
        return `
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
                            <SVFROMDATE>${fromStr}</SVFROMDATE>
                            <SVTODATE>${toStr}</SVTODATE>
                        </STATICVARIABLES>
                    </REQUESTDESC>
                </EXPORTDATA>
            </BODY>
        </ENVELOPE>`;
    }

    // --- NEW V4 JSON METHODS (Smart Sync) ---

    static getMastersJSON() {
        return `
        <ENVELOPE>
            <HEADER>
                <TALLYREQUEST>Export Data</TALLYREQUEST>
            </HEADER>
            <BODY>
                <EXPORTDATA>
                    <REQUESTDESC>
                        <REPORTNAME>List of Accounts</REPORTNAME>
                        <STATICVARIABLES>
                            <SVEXPORTFORMAT>JSONEx</SVEXPORTFORMAT>
                            <ACCOUNTTYPE>All Masters</ACCOUNTTYPE>
                        </STATICVARIABLES>
                    </REQUESTDESC>
                </EXPORTDATA>
            </BODY>
        </ENVELOPE>`;
    }

    static getGroupsJSON() {
        return `
        <ENVELOPE>
            <HEADER>
                <TALLYREQUEST>Export Data</TALLYREQUEST>
            </HEADER>
            <BODY>
                <EXPORTDATA>
                    <REQUESTDESC>
                        <REPORTNAME>List of Accounts</REPORTNAME>
                        <STATICVARIABLES>
                            <SVEXPORTFORMAT>JSONEx</SVEXPORTFORMAT>
                            <ACCOUNTTYPE>Groups</ACCOUNTTYPE>
                        </STATICVARIABLES>
                    </REQUESTDESC>
                </EXPORTDATA>
            </BODY>
        </ENVELOPE>`;
    }

    static getLedgersJSON() {
        return `
        <ENVELOPE>
            <HEADER>
                <TALLYREQUEST>Export Data</TALLYREQUEST>
            </HEADER>
            <BODY>
                <EXPORTDATA>
                    <REQUESTDESC>
                        <REPORTNAME>List of Accounts</REPORTNAME>
                        <STATICVARIABLES>
                            <SVEXPORTFORMAT>JSONEx</SVEXPORTFORMAT>
                            <ACCOUNTTYPE>Ledgers</ACCOUNTTYPE>
                        </STATICVARIABLES>
                    </REQUESTDESC>
                </EXPORTDATA>
            </BODY>
        </ENVELOPE>`;
    }

    // Full Fetch by Date (JSON)
    static getVouchersJSON(fromDate, toDate) {
        const fromStr = format(fromDate, 'yyyyMMdd');
        const toStr = format(toDate, 'yyyyMMdd');
        return `
        <ENVELOPE>
            <HEADER>
                <TALLYREQUEST>Export Data</TALLYREQUEST>
            </HEADER>
            <BODY>
                <EXPORTDATA>
                    <REQUESTDESC>
                        <REPORTNAME>Voucher Register</REPORTNAME>
                        <STATICVARIABLES>
                            <SVEXPORTFORMAT>JSONEx</SVEXPORTFORMAT>
                            <SVFROMDATE>${fromStr}</SVFROMDATE>
                            <SVTODATE>${toStr}</SVTODATE>
                        </STATICVARIABLES>
                    </REQUESTDESC>
                </EXPORTDATA>
            </BODY>
        </ENVELOPE>`;
    }

    // Incremental Fetch by AlterId
    static getIncrementalVouchers(minAlterId) {
        // We define a Custom Collection with a Filter
        return `
        <ENVELOPE>
            <HEADER>
                <VERSION>1</VERSION>
                <TALLYREQUEST>Export</TALLYREQUEST>
                <TYPE>Collection</TYPE>
                <ID>BizStashIncremental</ID>
            </HEADER>
            <BODY>
                <DESC>
                    <STATICVARIABLES>
                        <SVEXPORTFORMAT>JSONEx</SVEXPORTFORMAT>
                    </STATICVARIABLES>
                    <TDL>
                        <TDLMESSAGE>
                            <COLLECTION NAME="BizStashIncremental">
                                <TYPE>Voucher</TYPE>
                                <FILTERS>FilterByAlterID</FILTERS>
                                <!-- Optional: Optimization fields here -->
                            </COLLECTION>
                            <SYSTEM TYPE="Formulae" NAME="FilterByAlterID">
                                $AlterId > ${minAlterId}
                            </SYSTEM>
                        </TDLMESSAGE>
                    </TDL>
                </DESC>
            </BODY>
        </ENVELOPE>`;
    }
}

module.exports = TdlBuilder;
