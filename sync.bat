@echo off
set TALLY_PAL_DIR=%~dp0

echo ==========================================
echo      Tally Sync - Multi-Company Agent
echo ==========================================
echo.

:: 1. Fetch Data
echo [Step 1] Fetching Data from Tally...
node "%TALLY_PAL_DIR%fetch_tally_v2.js"

:: 2. Process Data
echo [Step 2] Processing Data...
node "%TALLY_PAL_DIR%process_tally_v2.js"

:: 3. Git Sync (Optional - Uncomment to enable)
:: echo [Step 3] Syncing to GitHub...
:: git add .
:: git commit -m "Auto-sync Tally Data: %date% %time%"
:: git push origin main

echo.
echo ==========================================
echo           Sync Complete!
echo ==========================================
pause
