@echo off
cd /d "C:\Projects\Bizstash"
echo Pulling latest code...
git pull origin main
echo Starting Tally Sync for sf-sklm...
node sync_engine.js "SF_SKLM"
echo [3/3] Uploading to Bizstash Cloud...
git add .
git commit -m "Data Sync: %date% %time%"
git push origin main
echo ==========================================
echo      SYNC COMPLETE - DASHBOARD UPDATED
echo ==========================================
pause
