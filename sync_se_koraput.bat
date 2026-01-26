@echo off
cd /d "%~dp0"
echo Pulling latest code...
git pull origin main
echo Starting Tally Sync for se-koraput...
node sync_engine.js "SE_Koraput"
echo [3/3] Uploading to Bizstash Cloud...
git add .
git commit -m "Data Sync: %date% %time%"
git push origin main
echo ==========================================
echo      SYNC COMPLETE - DASHBOARD UPDATED
echo ==========================================
pause
