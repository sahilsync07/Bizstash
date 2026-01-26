@echo off
cd /d "%~dp0"
echo Pulling latest code...
git pull origin main
echo Starting Tally Sync for sbem-malkangiri...
node sync_engine.js "SBEM_Malkangiri"
echo [3/3] Uploading to Bizstash Cloud...
git add .
git commit -m "Data Sync: %date% %time%"
git push origin main
echo ==========================================
echo      SYNC COMPLETE - DASHBOARD UPDATED
echo ==========================================
pause
