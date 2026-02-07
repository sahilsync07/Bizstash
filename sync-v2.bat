@echo off
title BIZSTASH SYNC ENGINE V3
cd /d "%~dp0"

echo.
echo ==========================================
echo   BIZSTASH SYNC V3 (New Engine)
echo ==========================================
echo.

:: Run the new Node.js sync engine
:: Pass the company name here (e.g., Admin_Test_PC)
node sync/index.js "Admin_Test_PC"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ❌ SYNC FAILED with Code %ERRORLEVEL%
    color c0
) else (
    echo.
    echo ✅ SYNC SUCCESSFUL
    color a0
)

pause
color 07
