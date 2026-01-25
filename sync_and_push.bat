@echo off
echo ==========================================
echo      BIZSTASH - DATA SYNCHRONIZATION
echo ==========================================

echo [1/3] Running Unified Sync Engine...
node sync_engine.js
if %errorlevel% neq 0 (
    echo Sync Engine failed. Aborting.
    pause
    exit /b %errorlevel%
)

echo [2/3] Staging Data for Cloud...
git add dashboard/public/data

echo [3/3] Uploading to Bizstash Cloud...
git commit -m "Data Sync: %date% %time%"
git push origin main

echo ==========================================
echo      SYNC COMPLETE - DASHBOARD UPDATED
echo ==========================================
pause
