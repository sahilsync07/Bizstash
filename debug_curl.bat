@echo off
echo Sending Request to Tally...
curl -X POST http://localhost:9000 -H "Content-Type:text/xml" -d @debug_payload.xml -o debug_response.xml --verbose
if %errorlevel% neq 0 (
    echo CURL Failed.
) else (
    echo CURL Success. Output saved to debug_response.xml.
    type debug_response.xml
)
