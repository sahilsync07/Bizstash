const { format } = require('date-fns');

class TdlBuilder {

    // --- Company Info (lightweight ping) ---
    static getCompanyInfo() {
        return `
        <ENVELOPE>
            <HEADER>
                <VERSION>1</VERSION>
                <TALLYREQUEST>Export</TALLYREQUEST>
                <TYPE>Collection</TYPE>
                <ID>ActiveCompanyDetect</ID>
            </HEADER>
            <BODY>
                <DESC>
                    <STATICVARIABLES>
                        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
                    </STATICVARIABLES>
                    <TDL>
                        <TDLMESSAGE>
                            <COLLECTION NAME="ActiveCompanyDetect">
                                <TYPE>Company</TYPE>
                                <FETCH>Name</FETCH>
                                <COMPUTE>CurrentCompany : ##SVCurrentCompany</COMPUTE>
                            </COLLECTION>
                        </TDLMESSAGE>
                    </TDL>
                </DESC>
            </BODY>
        </ENVELOPE>`;
    }

    // --- Company Statistics (for Pre-Sync Dashboard) ---
    static getCompanyStats() {
        return `
        <ENVELOPE>
            <HEADER>
                <VERSION>1</VERSION>
                <TALLYREQUEST>Export</TALLYREQUEST>
                <TYPE>Collection</TYPE>
                <ID>CompanyStatsForSync</ID>
            </HEADER>
            <BODY>
                <DESC>
                    <STATICVARIABLES>
                        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
                    </STATICVARIABLES>
                    <TDL>
                        <TDLMESSAGE>
                            <COLLECTION NAME="CompanyStatsForSync">
                                <TYPE>Company</TYPE>
                                <FETCH>Name, StartingFrom, BooksFrom, LastVoucherDate, MobileNo</FETCH>
                                <COMPUTE>CurrentCompany : ##SVCurrentCompany</COMPUTE>
                            </COLLECTION>
                        </TDLMESSAGE>
                    </TDL>
                </DESC>
            </BODY>
        </ENVELOPE>`;
    }

    // --- Voucher Count (lightweight, for dashboard) ---
    static getVoucherCount() {
        return `
        <ENVELOPE>
            <HEADER>
                <VERSION>1</VERSION>
                <TALLYREQUEST>Export</TALLYREQUEST>
                <TYPE>Collection</TYPE>
                <ID>VoucherCountColl</ID>
            </HEADER>
            <BODY>
                <DESC>
                    <STATICVARIABLES>
                        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
                    </STATICVARIABLES>
                    <TDL>
                        <TDLMESSAGE>
                            <COLLECTION NAME="VoucherCountColl">
                                <TYPE>Voucher</TYPE>
                                <FETCH>VoucherNumber</FETCH>
                            </COLLECTION>
                        </TDLMESSAGE>
                    </TDL>
                </DESC>
            </BODY>
        </ENVELOPE>`;
    }

    // --- ALL Vouchers (single fetch - PROVEN from Building Block 2) ---
    static getAllVouchers() {
        return `
        <ENVELOPE>
            <HEADER>
                <VERSION>1</VERSION>
                <TALLYREQUEST>Export</TALLYREQUEST>
                <TYPE>Collection</TYPE>
                <ID>VoucherAllColl</ID>
            </HEADER>
            <BODY>
                <DESC>
                    <STATICVARIABLES>
                        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
                    </STATICVARIABLES>
                    <TDL>
                        <TDLMESSAGE>
                            <COLLECTION NAME="VoucherAllColl">
                                <TYPE>Voucher</TYPE>
                                <FETCH>Date, VoucherNumber, VoucherTypeName, PartyLedgerName, Amount, Reference, Narration, IsCancelled, IsOptional</FETCH>
                                <FETCH>AllLedgerEntries.*</FETCH>
                                <FETCH>AllInventoryEntries.*</FETCH>
                            </COLLECTION>
                        </TDLMESSAGE>
                    </TDL>
                </DESC>
            </BODY>
        </ENVELOPE>`;
    }
    // --- Groups (for hierarchy) ---
    static getGroups() {
        return `
        <ENVELOPE>
            <HEADER>
                <VERSION>1</VERSION>
                <TALLYREQUEST>Export</TALLYREQUEST>
                <TYPE>Collection</TYPE>
                <ID>GroupColl</ID>
            </HEADER>
            <BODY>
                <DESC>
                    <STATICVARIABLES>
                        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
                    </STATICVARIABLES>
                    <TDL>
                        <TDLMESSAGE>
                            <COLLECTION NAME="GroupColl">
                                <TYPE>Group</TYPE>
                                <FETCH>Name, Parent</FETCH>
                            </COLLECTION>
                        </TDLMESSAGE>
                    </TDL>
                </DESC>
            </BODY>
        </ENVELOPE>`;
    }

    // --- Ledgers (for Opening Balance) ---
    static getLedgers() {
        return `
        <ENVELOPE>
            <HEADER>
                <VERSION>1</VERSION>
                <TALLYREQUEST>Export</TALLYREQUEST>
                <TYPE>Collection</TYPE>
                <ID>LedgerColl</ID>
            </HEADER>
            <BODY>
                <DESC>
                    <STATICVARIABLES>
                        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
                    </STATICVARIABLES>
                    <TDL>
                        <TDLMESSAGE>
                            <COLLECTION NAME="LedgerColl">
                                <TYPE>Ledger</TYPE>
                                <FETCH>Name, Parent, OpeningBalance</FETCH>
                            </COLLECTION>
                        </TDLMESSAGE>
                    </TDL>
                </DESC>
            </BODY>
        </ENVELOPE>`;
    }

    // --- Profit & Loss Report (for Gross/Net Profit) ---
    static getProfitLossRequest() {
        return `
        <ENVELOPE>
            <HEADER>
                <VERSION>1</VERSION>
                <TALLYREQUEST>Export Data</TALLYREQUEST>
                <TYPE>Report</TYPE>
                <ID>Profit and Loss</ID>
            </HEADER>
            <BODY>
                <DESC>
                    <STATICVARIABLES>
                        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
                        <EXPLODEFLAG>No</EXPLODEFLAG>
                    </STATICVARIABLES>
                </DESC>
            </BODY>
        </ENVELOPE>`;
    }
}

module.exports = TdlBuilder;
