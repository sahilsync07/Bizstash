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

    // --- ALL Vouchers (full sync — chunked by month) ---
    static getAllVouchers(fromDate, toDate) {
        let staticVars = `<SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>`;
        if (fromDate && toDate) {
            staticVars += `
                        <SVFROMDATE>${fromDate}</SVFROMDATE>
                        <SVTODATE>${toDate}</SVTODATE>`;
        }

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
                        ${staticVars}
                    </STATICVARIABLES>
                    <TDL>
                        <TDLMESSAGE>
                            <COLLECTION NAME="VoucherAllColl">
                                <TYPE>Voucher</TYPE>
                                <FILTER>VchDateFilter</FILTER>
                                <FETCH>Date, VoucherNumber, VoucherTypeName, PartyLedgerName, Amount, Reference, Narration, IsCancelled, IsOptional, AlterID, MasterID</FETCH>
                                <FETCH>AllLedgerEntries.LedgerName, AllLedgerEntries.Amount, AllLedgerEntries.IsDeemedPositive, AllLedgerEntries.BillAllocations.*</FETCH>
                                <FETCH>AllInventoryEntries.StockItemName, AllInventoryEntries.BilledQty, AllInventoryEntries.Amount, AllInventoryEntries.Rate, AllInventoryEntries.AccountingAllocations.*</FETCH>
                            </COLLECTION>
                            <SYSTEM TYPE="Formula" NAME="VchDateFilter">($Date &gt;= ##SVFromDate) AND ($Date &lt;= ##SVToDate)</SYSTEM>
                        </TDLMESSAGE>
                    </TDL>
                </DESC>
            </BODY>
        </ENVELOPE>`;
    }

    // --- DELTA Vouchers (fetch only changes since last sync via ALTERID) ---
    static getDeltaVouchers(minAlterId) {
        return `
        <ENVELOPE>
            <HEADER>
                <VERSION>1</VERSION>
                <TALLYREQUEST>Export</TALLYREQUEST>
                <TYPE>Collection</TYPE>
                <ID>VoucherDeltaColl</ID>
            </HEADER>
            <BODY>
                <DESC>
                    <STATICVARIABLES>
                        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
                    </STATICVARIABLES>
                    <TDL>
                        <TDLMESSAGE>
                            <COLLECTION NAME="VoucherDeltaColl">
                                <TYPE>Voucher</TYPE>
                                <FILTER>AlterIdFilter</FILTER>
                                <FETCH>Date, VoucherNumber, VoucherTypeName, PartyLedgerName, Amount, Reference, Narration, IsCancelled, IsOptional, AlterID, MasterID</FETCH>
                                <FETCH>AllLedgerEntries.LedgerName, AllLedgerEntries.Amount, AllLedgerEntries.IsDeemedPositive, AllLedgerEntries.BillAllocations.*</FETCH>
                                <FETCH>AllInventoryEntries.StockItemName, AllInventoryEntries.BilledQty, AllInventoryEntries.Amount, AllInventoryEntries.Rate, AllInventoryEntries.AccountingAllocations.*</FETCH>
                            </COLLECTION>
                            <SYSTEM TYPE="Formula" NAME="AlterIdFilter">$AlterID &gt; ${minAlterId}</SYSTEM>
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
