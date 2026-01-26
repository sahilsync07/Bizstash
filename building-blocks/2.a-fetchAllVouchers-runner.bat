@echo off
setlocal EnableDelayedExpansion

echo --- Step 1: Generating Payload for All Vouchers... ---
(
echo ^<ENVELOPE^>
echo     ^<HEADER^>
echo         ^<VERSION^>1^</VERSION^>
echo         ^<TALLYREQUEST^>Export^</TALLYREQUEST^>
echo         ^<TYPE^>Collection^</TYPE^>
echo         ^<ID^>AllVouchersColl^</ID^>
echo     ^</HEADER^>
echo     ^<BODY^>
echo         ^<DESC^>
echo             ^<STATICVARIABLES^>
echo                 ^<SVEXPORTFORMAT^>$$SysName:XML^</SVEXPORTFORMAT^>
echo             ^</STATICVARIABLES^>
echo             ^<TDL^>
echo                 ^<TDLMESSAGE^>
echo                     ^<COLLECTION NAME="AllVouchersColl"^>
echo                         ^<TYPE^>Voucher^</TYPE^>
echo                         ^<FETCH^>Date, VoucherNumber, VoucherTypeName, PartyLedgerName, Amount^</FETCH^>
echo                     ^</COLLECTION^>
echo                 ^</TDLMESSAGE^>
echo             ^</TDL^>
echo         ^</DESC^>
echo     ^</BODY^>
echo ^</ENVELOPE^>
) > temp_2.xml

echo --- Step 2: Sending Request (2.a) -> Tally -> XML Output (2.b) ---
echo Fetching ~4500 records...
curl -X POST http://localhost:9000 ^
    -H "Content-Type:text/xml" ^
    -d @temp_2.xml ^
    -o "2.b-fetchAllVouchers-xml-output.xml"

if %errorlevel% neq 0 (
    echo Error: CURL request failed.
    del temp_2.xml
    exit /b %errorlevel%
)

echo.
echo --- Step 3: Processor (2.c) transforms 2.b -> JSON Output (2.d) ---
node "2.c-fetchAllVouchers-processor.js"

if %errorlevel% neq 0 (
    echo Error: Node.js processing failed.
    del temp_2.xml
    exit /b %errorlevel%
)

:: Cleanup
del temp_2.xml

echo.
echo --- Success! 2.d Output generated. ---
