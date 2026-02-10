# Bizstash PC Setup Script for Accountants
# This script automates the installation of Node.js and project dependencies.

$ErrorActionPreference = "Stop"

function Write-Header($msg) {
    Write-Host "`n================================================" -ForegroundColor Cyan
    Write-Host "   $msg" -ForegroundColor White -BackgroundColor Black
    Write-Host "================================================`n" -ForegroundColor Cyan
}

function Check-Command($cmd) {
    $found = Get-Command $cmd -ErrorAction SilentlyContinue
    return $found -ne $null
}

Write-Header "BIZSTASH AUTO-INSTALLER"

# 1. Check for Node.js
Write-Host "[1/3] Checking Node.js..." -NoNewline
if (Check-Command "node") {
    $version = node -v
    Write-Host " Found ($version)" -ForegroundColor Green
} else {
    Write-Host " Missing!" -ForegroundColor Yellow
    Write-Host "Installing Node.js via winget... (Please wait)" -ForegroundColor Cyan
    winget install OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Node.js installed successfully. You might need to restart this script after completion." -ForegroundColor Green
    } else {
        Write-Host "❌ Failed to install Node.js automatically. Please install it manually from nodejs.org" -ForegroundColor Red
        exit 1
    }
}

# 2. Check for Git & GitHub CLI
Write-Host "[2/3] Checking Git..." -NoNewline
if (Check-Command "git") {
    $version = git --version
    Write-Host " Found ($version)" -ForegroundColor Green
} else {
    Write-Host " Missing!" -ForegroundColor Yellow
    Write-Host "Installing Git via winget..." -ForegroundColor Cyan
    winget install Git.Git --silent --accept-package-agreements --accept-source-agreements
}

Write-Host "[2.5/3] Checking GitHub CLI..." -NoNewline
if (Check-Command "gh") {
    $version = gh --version | Select-Object -First 1
    Write-Host " Found ($version)" -ForegroundColor Green
} else {
    Write-Host " Missing!" -ForegroundColor Yellow
    Write-Host "Installing GitHub CLI via winget..." -ForegroundColor Cyan
    winget install GitHub.cli --silent --accept-package-agreements --accept-source-agreements
}

# 3. Install Project Dependencies
Write-Header "INSTALLING PROJECT DEPENDENCIES"

Write-Host "1. Installing root dependencies..." -ForegroundColor Cyan
npm install

if (Test-Path "dashboard") {
    Write-Host "2. Installing dashboard dependencies..." -ForegroundColor Cyan
    Set-Location dashboard
    npm install
    Set-Location ..
}

Write-Header "SETUP COMPLETE ✅"
Write-Host "You can now run the 'sync' bat files to start synchronization." -ForegroundColor Green
Write-Host "Press any key to exit..."
$Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown") | Out-Null
