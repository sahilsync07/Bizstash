@echo off
cd /d "C:\Projects\Bizstash"
echo Pulling latest code...
git pull origin main
echo Starting Tally Sync for Admin Trial...
node sync_engine.js "Admin_Test_PC"
echo ==========================================
echo      SYNC COMPLETE - DASHBOARD UPDATED
echo ==========================================
pause
