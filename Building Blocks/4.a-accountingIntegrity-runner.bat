@echo off
setlocal EnableDelayedExpansion

echo [4.a] Generating Payload 1 (Trial Balance)...
(
echo ^<ENVELOPE^>
echo     ^<HEADER^>
echo         ^<VERSION^>1^</VERSION^>
echo         ^<TALLYREQUEST^>Export^</TALLYREQUEST^>
echo         ^<TYPE^>Data^</TYPE^>
echo         ^<ID^>Trial Balance^</ID^>
echo     ^</HEADER^>
echo     ^<BODY^>
echo         ^<DESC^>
echo             ^<STATICVARIABLES^>
echo                 ^<EXPLODEFLAG^>No^</EXPLODEFLAG^>
echo                 ^<SVEXPORTFORMAT^>$$SysName:XML^</SVEXPORTFORMAT^>
echo             ^</STATICVARIABLES^>
echo         ^</DESC^>
echo     ^</BODY^>
echo ^</ENVELOPE^>
) > temp_4_tb.xml

echo [4.a] Executing Curl 1 (TB) -> 4.b-trialBalance...
curl -X POST http://localhost:9000 ^
    -H "Content-Type:text/xml" ^
    -d @temp_4_tb.xml ^
    -o "4.b-accountingIntegrity-TB-xml-output.xml"

if %errorlevel% neq 0 (
    echo Error: CURL TB failed.
    del temp_4_tb.xml
    exit /b 1
)

echo [4.a] Generating Payload 2 (Profit and Loss)...
(
echo ^<ENVELOPE^>
echo     ^<HEADER^>
echo         ^<VERSION^>1^</VERSION^>
echo         ^<TALLYREQUEST^>Export^</TALLYREQUEST^>
echo         ^<TYPE^>Object^</TYPE^>
echo         ^<SUBTYPE^>Ledger^</SUBTYPE^>
echo         ^<ID TYPE="Name"^>Profit ^& Loss A/c^</ID^>
echo     ^</HEADER^>
echo     ^<BODY^>
echo         ^<DESC^>
echo             ^<STATICVARIABLES^>
echo                 ^<SVEXPORTFORMAT^>$$SysName:XML^</SVEXPORTFORMAT^>
echo             ^</STATICVARIABLES^>
echo             ^<FETCHLIST^>
echo                 ^<FETCH^>Name^</FETCH^>
echo                 ^<FETCH^>ClosingBalance^</FETCH^>
echo             ^</FETCHLIST^>
echo         ^</DESC^>
echo     ^</BODY^>
echo ^</ENVELOPE^>
) > temp_4_pl.xml

echo [4.a] Executing Curl 2 (PL) -> 4.b-profitLoss...
curl -X POST http://localhost:9000 ^
    -H "Content-Type:text/xml" ^
    -d @temp_4_pl.xml ^
    -o "4.b-accountingIntegrity-PL-xml-output.xml"

if %errorlevel% neq 0 (
    echo Error: CURL PL failed.
    del temp_4_tb.xml temp_4_pl.xml
    exit /b 1
)

echo [4.a] Running Processor 4.c -> 4.d...
node "4.c-accountingIntegrity-processor.js"

if %errorlevel% neq 0 (
    echo Error: Processor failed.
    del temp_4_tb.xml temp_4_pl.xml
    exit /b 1
)

del temp_4_tb.xml temp_4_pl.xml
echo [4.a] Complete.
