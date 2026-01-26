@echo off
setlocal EnableDelayedExpansion

echo [7.a] Generating Payload (Fetch All Vouchers for Stats)...
(
echo ^<ENVELOPE^>
echo     ^<HEADER^>
echo         ^<VERSION^>1^</VERSION^>
echo         ^<TALLYREQUEST^>Export^</TALLYREQUEST^>
echo         ^<TYPE^>Collection^</TYPE^>
echo         ^<ID^>AllVoucherTypesColl^</ID^>
echo     ^</HEADER^>
echo     ^<BODY^>
echo         ^<DESC^>
echo             ^<STATICVARIABLES^>
echo                 ^<SVEXPORTFORMAT^>$$SysName:XML^</SVEXPORTFORMAT^>
echo                 ^<SVFROMDATE^>20240401^</SVFROMDATE^>
echo                 ^<SVTODATE^>20250331^</SVTODATE^>
echo             ^</STATICVARIABLES^>
echo             ^<TDL^>
echo                 ^<TDLMESSAGE^>
echo                     ^<COLLECTION NAME="AllVoucherTypesColl" ISINITIALIZE="Yes"^>
echo                         ^<TYPE^>Voucher^</TYPE^>
echo                         ^<FETCH^>VoucherTypeName^</FETCH^>
echo                     ^</COLLECTION^>
echo                 ^</TDLMESSAGE^>
echo             ^</TDL^>
echo         ^</DESC^>
echo     ^</BODY^>
echo ^</ENVELOPE^>
) > temp_7.xml

echo [7.a] Executing Curl -> 7.b_new...
curl -X POST http://localhost:9000 ^
    -H "Content-Type:text/xml" ^
    -d @temp_7.xml ^
    -o "7.b_new.xml"

if %errorlevel% neq 0 (
    echo Error: CURL failed.
    del temp_7.xml
    exit /b 1
)

echo [7.a] Running Processor 7.c -> 7.d...
node "7.c-voucherTypeStats-processor.js"

if %errorlevel% neq 0 (
    echo Error: Processor failed.
    del temp_7.xml
    exit /b 1
)

del temp_7.xml
echo [7.a] Complete.
