@echo off
setlocal

echo [8.a] Generating Payload (Trial Balance)...
(
echo ^<ENVELOPE^>
echo ^<HEADER^>^<VERSION^>1^</VERSION^>^<TALLYREQUEST^>Export^</TALLYREQUEST^>^<TYPE^>Data^</TYPE^>^<ID^>Trial Balance^</ID^>^</HEADER^>
echo ^<BODY^>^<DESC^>^<STATICVARIABLES^>^<SVEXPORTFORMAT^>$$SysName:XML^</SVEXPORTFORMAT^>^<EXPLODEFLAG^>No^</EXPLODEFLAG^>^</STATICVARIABLES^>^</DESC^>^</BODY^>
echo ^</ENVELOPE^>
) > temp_8_tb.xml

echo [8.a] Fetching Trial Balance -> 8.b-balanceSheet-xml-output.xml...
curl -X POST http://localhost:9000 -H "Content-Type:text/xml" -d @temp_8_tb.xml -o "8.b-balanceSheet-xml-output.xml"

echo [8.a] Running Processor...
node "8.c-balanceSheet-processor.js"

:: Cleanup
del temp_8_tb.xml
echo [8.a] Done.
