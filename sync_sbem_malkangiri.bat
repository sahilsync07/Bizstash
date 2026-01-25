@echo off
cd /d "C:\Projects\Bizstash"
echo Pulling latest code...
git pull origin main
echo Starting Tally Sync for sbem-malkangiri...
node sync_engine.js "sbem-malkangiri"
echo ==========================================
echo      SYNC COMPLETE - DASHBOARD UPDATED
echo ==========================================
pause
