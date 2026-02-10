@echo off
TITLE Bizstash PC Setup
echo ================================================
echo    Starting Bizstash Auto-Installation...
echo ================================================
echo.

:: Check for Administrative privileges
net session >nul 2>&1
if %errorLevel% == 0 (
    echo [INFO] Running with Administrative privileges...
) else (
    echo [WARNING] This script might need Administrative privileges to install Node.js.
    echo [WARNING] If it fails, please right-click and 'Run as Administrator'.
    echo.
)

:: Run PowerShell script
powershell -ExecutionPolicy Bypass -File "%~dp0setup_pc.ps1"

if %errorLevel% neq 0 (
    echo.
    echo [ERROR] Setup failed with error code %errorLevel%
    pause
)
