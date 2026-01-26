@echo off
setlocal EnableDelayedExpansion

echo [6.a] Generating Payload (Inventory Per Item)...
(
echo ^<ENVELOPE^>
echo     ^<HEADER^>
echo         ^<VERSION^>1^</VERSION^>
echo         ^<TALLYREQUEST^>Export^</TALLYREQUEST^>
echo         ^<TYPE^>Collection^</TYPE^>
echo         ^<ID^>AllStockItemsDetailed^</ID^>
echo     ^</HEADER^>
echo     ^<BODY^>
echo         ^<DESC^>
echo             ^<STATICVARIABLES^>
echo                 ^<SVEXPORTFORMAT^>$$SysName:XML^</SVEXPORTFORMAT^>
echo             ^</STATICVARIABLES^>
echo             ^<TDL^>
echo                 ^<TDLMESSAGE^>
echo                     ^<COLLECTION NAME="AllStockItemsDetailed" ISINITIALIZE="Yes"^>
echo                         ^<TYPE^>Stock Item^</TYPE^>
echo                         ^<FETCH^>Name, ClosingBalance, ClosingValue^</FETCH^>
echo                     ^</COLLECTION^>
echo                 ^</TDLMESSAGE^>
echo             ^</TDL^>
echo         ^</DESC^>
echo     ^</BODY^>
echo ^</ENVELOPE^>
) > temp_6.xml

echo [6.a] Executing Curl -> 6.b...
curl -X POST http://localhost:9000 ^
    -H "Content-Type:text/xml" ^
    -d @temp_6.xml ^
    -o "6.b-inventoryPerItem-xml-output.xml"

if %errorlevel% neq 0 (
    echo Error: CURL failed.
    del temp_6.xml
    exit /b 1
)

echo [6.a] Running Processor 6.c -> 6.d...
node "6.c-inventoryPerItem-processor.js"

if %errorlevel% neq 0 (
    echo Error: Processor failed.
    del temp_6.xml
    exit /b 1
)

del temp_6.xml
echo [6.a] Complete.
