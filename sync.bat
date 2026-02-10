@echo off
title BIZSTASH AUTO-SYNC
cd /d "%~dp0"

echo.
echo ==========================================
echo       BIZSTASH AUTO-SYNC ENGINE
echo ==========================================
echo.

:: Pul latest code (optional but recommended for central repo)
echo [1/3] Pulling latest code...
git pull origin main

:: Run the auto-detect sync script
echo [2/3] Detecting Company and Syncing...
node sync/auto_sync.js

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ❌ SYNC FAILED
    echo Please ensure Tally is open and the correct company is active.
    pause
    exit /b 1
)

:: Push to GitHub
echo [3/3] Uploading to Bizstash Cloud...
git add .
git commit -m "Auto-Sync: %date% %time%"
git push origin main

echo.
echo ==========================================
echo      SYNC COMPLETE - DASHBOARD UPDATED
echo ==========================================
pause
