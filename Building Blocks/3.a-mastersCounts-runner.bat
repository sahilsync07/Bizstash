@echo off
setlocal EnableDelayedExpansion

echo [3.a] Generating Payload...
(
echo ^<ENVELOPE^>
echo     ^<HEADER^>
echo         ^<VERSION^>1^</VERSION^>
echo         ^<TALLYREQUEST^>Export^</TALLYREQUEST^>
echo         ^<TYPE^>Collection^</TYPE^>
echo         ^<ID^>MasterCountCollection^</ID^>
echo     ^</HEADER^>
echo     ^<BODY^>
echo         ^<DESC^>
echo             ^<STATICVARIABLES^>
echo                 ^<SVEXPORTFORMAT^>$$SysName:XML^</SVEXPORTFORMAT^>
echo             ^</STATICVARIABLES^>
echo             ^<TDL^>
echo                 ^<TDLMESSAGE^>
echo                     ^<COLLECTION NAME="MasterCountCollection" ISINITIALIZE="Yes"^>
echo                         ^<TYPE^>Company^</TYPE^>
echo                         ^<COMPUTE^>CountGroups: $$NumGroups^</COMPUTE^>
echo                         ^<COMPUTE^>CountLedgers: $$NumLedgers^</COMPUTE^>
echo                         ^<COMPUTE^>CountStockItems: $$NumStockItems^</COMPUTE^>
echo                     ^</COLLECTION^>
echo                 ^</TDLMESSAGE^>
echo             ^</TDL^>
echo         ^</DESC^>
echo     ^</BODY^>
echo ^</ENVELOPE^>
) > temp_3.xml

echo [3.a] Executing Curl -> 3.b...
curl -X POST http://localhost:9000 ^
    -H "Content-Type:text/xml" ^
    -d @temp_3.xml ^
    -o "3.b-mastersCounts-xml-output.xml"

if %errorlevel% neq 0 (
    echo Error: CURL failed.
    del temp_3.xml
    exit /b 1
)

echo [3.a] Running Processor 3.c -> 3.d...
node "3.c-mastersCounts-processor.js"

if %errorlevel% neq 0 (
    echo Error: Processor failed.
    del temp_3.xml
    exit /b 1
)

del temp_3.xml
echo [3.a] Complete.
