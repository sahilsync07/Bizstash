@echo off
cd /d "C:\Projects\Bizstash"
echo Pulling latest code...
git pull origin main
echo Starting Tally Sync for sbe-rayagada...
node sync_engine.js "sbe-rayagada"
echo ==========================================
echo      SYNC COMPLETE - DASHBOARD UPDATED
echo ==========================================
pause
