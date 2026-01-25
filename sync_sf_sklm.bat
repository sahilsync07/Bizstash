@echo off
cd /d "C:\Projects\Bizstash"
echo Pulling latest code...
git pull origin main
echo Starting Tally Sync for sf-sklm...
node sync_engine.js "sf-sklm"
echo ==========================================
echo      SYNC COMPLETE - DASHBOARD UPDATED
echo ==========================================
pause
