@echo off
setlocal EnableDelayedExpansion

echo [1.a] Generating Payload...
(
echo ^<ENVELOPE^>
echo     ^<HEADER^>
echo         ^<VERSION^>1^</VERSION^>
echo         ^<TALLYREQUEST^>Export^</TALLYREQUEST^>
echo         ^<TYPE^>Collection^</TYPE^>
echo         ^<ID^>VoucherStatsColl^</ID^>
echo     ^</HEADER^>
echo     ^<BODY^>
echo         ^<DESC^>
echo             ^<STATICVARIABLES^>
echo                 ^<SVEXPORTFORMAT^>$$SysName:XML^</SVEXPORTFORMAT^>
echo             ^</STATICVARIABLES^>
echo             ^<TDL^>
echo                 ^<TDLMESSAGE^>
echo                     ^<COLLECTION NAME="VoucherStatsColl"^>
echo                         ^<TYPE^>Voucher^</TYPE^>
echo                         ^<FETCH^>Date^</FETCH^>
echo                         ^<COMPUTE^>CompanyName: ##SVCurrentCompany^</COMPUTE^>
echo                     ^</COLLECTION^>
echo                 ^</TDLMESSAGE^>
echo             ^</TDL^>
echo         ^</DESC^>
echo     ^</BODY^>
echo ^</ENVELOPE^>
) > temp_1.xml

echo [1.a] Executing Curl -> 1.b...
curl -X POST http://localhost:9000 ^
    -H "Content-Type:text/xml" ^
    -d @temp_1.xml ^
    -o "1.b-companyName-fromDate-toDate-voucherQty-xml-output.xml"

if %errorlevel% neq 0 (
    echo Error: CURL failed.
    del temp_1.xml
    exit /b 1
)

echo [1.a] Running Processor 1.c -> 1.d...
node "1.c-companyName-fromDate-toDate-voucherQty-processor.js"

if %errorlevel% neq 0 (
    echo Error: Processor failed.
    del temp_1.xml
    exit /b 1
)

del temp_1.xml
echo [1.a] Complete.
