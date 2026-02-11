@echo off
title BIZSTASH SMART SYNC
cd /d "%~dp0"

echo.
echo ==========================================
echo    BIZSTASH SMART SYNC WRAPPER
echo ==========================================
echo.

:: Check for Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Node.js is NOT installed!
    echo Please run setup.bat first to install dependencies.
    pause
    exit /b
)

:: Run the Smart Node Wrapper
node sync/run.js

echo.
pause
