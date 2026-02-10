@echo off
title BIZSTASH SYNC ENGINE V5
cd /d "%~dp0"

echo.
echo ==========================================
echo   BIZSTASH SYNC V5 (Admin_Test_PC)
echo ==========================================
echo.

:: Pull latest code
echo [1/3] Pulling latest code...
git pull origin main

:: Run sync engine
echo [2/3] Syncing with Tally...
node sync/index.js "Admin_Test_PC"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ❌ SYNC FAILED with Code %ERRORLEVEL%
    color c0
    pause
    color 07
    exit /b 1
)

:: Push to GitHub
echo [3/3] Uploading to Bizstash Cloud...
git add .
git commit -m "Data Sync: %date% %time%"
git push origin main

echo.
echo ==========================================
echo      SYNC COMPLETE - DASHBOARD UPDATED
echo ==========================================
pause
color 07
