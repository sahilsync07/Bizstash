@echo off
setlocal EnableDelayedExpansion

if exist "5.b-inventorySummary-xml-output.xml" del "5.b-inventorySummary-xml-output.xml"

echo [5.a] Generating Payload (Collection Export - Fixed Type)...
(
echo ^<ENVELOPE^>
echo     ^<HEADER^>
echo         ^<VERSION^>1^</VERSION^>
echo         ^<TALLYREQUEST^>Export^</TALLYREQUEST^>
echo         ^<TYPE^>Collection^</TYPE^>
echo         ^<ID^>AllStockColl^</ID^>
echo     ^</HEADER^>
echo     ^<BODY^>
echo         ^<DESC^>
echo             ^<STATICVARIABLES^>
echo                 ^<SVEXPORTFORMAT^>$$SysName:XML^</SVEXPORTFORMAT^>
echo             ^</STATICVARIABLES^>
echo             ^<TDL^>
echo                 ^<TDLMESSAGE^>
echo                     ^<COLLECTION NAME="AllStockColl" ISINITIALIZE="Yes"^>
echo                         ^<TYPE^>Stock Item^</TYPE^>
echo                         ^<FETCH^>Name, ClosingBalance, ClosingValue^</FETCH^>
echo                     ^</COLLECTION^>
echo                 ^</TDLMESSAGE^>
echo             ^</TDL^>
echo         ^</DESC^>
echo     ^</BODY^>
echo ^</ENVELOPE^>
) > temp_5.xml

echo [5.a] Executing Curl -> 5.b_new...
curl -X POST http://localhost:9000 ^
    -H "Content-Type:text/xml" ^
    -d @temp_5.xml ^
    -o "5.b_new.xml"

if %errorlevel% neq 0 (
    echo Error: CURL failed.
    del temp_5.xml
    exit /b 1
)

echo [5.a] Running Processor 5.c -> 5.d...
node "5.c-inventorySummary-processor.js"

if %errorlevel% neq 0 (
    echo Error: Processor failed.
    del temp_5.xml
    exit /b 1
)

del temp_5.xml
echo [5.a] Complete.
