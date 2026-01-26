@echo off
setlocal EnableDelayedExpansion

echo [2.a] Generating Payload...
(
echo ^<ENVELOPE^>
echo     ^<HEADER^>
echo         ^<VERSION^>1^</VERSION^>
echo         ^<TALLYREQUEST^>Export^</TALLYREQUEST^>
echo         ^<TYPE^>Collection^</TYPE^>
echo         ^<ID^>VoucherAllColl^</ID^>
echo     ^</HEADER^>
echo     ^<BODY^>
echo         ^<DESC^>
echo             ^<STATICVARIABLES^>
echo                 ^<SVEXPORTFORMAT^>$$SysName:XML^</SVEXPORTFORMAT^>
echo             ^</STATICVARIABLES^>
echo             ^<TDL^>
echo                 ^<TDLMESSAGE^>
echo                     ^<COLLECTION NAME="VoucherAllColl"^>
echo                         ^<TYPE^>Voucher^</TYPE^>
echo                         ^<FETCH^>Date,VoucherNumber,VoucherTypeName,PartyLedgerName,Amount,Reference^</FETCH^>
echo                     ^</COLLECTION^>
echo                 ^</TDLMESSAGE^>
echo             ^</TDL^>
echo         ^</DESC^>
echo     ^</BODY^>
echo ^</ENVELOPE^>
) > temp_2.xml

echo [2.a] Executing Curl -> 2.b...
curl -X POST http://localhost:9000 ^
    -H "Content-Type:text/xml" ^
    -d @temp_2.xml ^
    -o "2.b-fetchAllVouchers-xml-output.xml"

if %errorlevel% neq 0 (
    echo Error: CURL failed.
    del temp_2.xml
    exit /b 1
)

echo [2.a] Running Processor 2.c -> 2.d...
node "2.c-fetchAllVouchers-processor.js"

if %errorlevel% neq 0 (
    echo Error: Processor failed.
    del temp_2.xml
    exit /b 1
)

del temp_2.xml
echo [2.a] Complete.
