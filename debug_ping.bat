@echo off
curl -X POST http://localhost:9000 -H "Content-Type:text/xml" -d @debug_ping.xml -o debug_ping.xml --verbose --max-time 10
if %errorlevel% neq 0 (
    echo Ping Failed
) else (
    echo Ping Success
)
