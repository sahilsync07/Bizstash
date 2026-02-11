const { execSync, spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const Logger = require('./utils/Logger');

// ---------------------------------------------------------
// CONFIGURATION
// ---------------------------------------------------------
const REPO_URL = 'https://github.com/sahilsync07/Bizstash';
const AUTH_URL = 'https://github.com/login';
const SYNC_SCRIPT = path.join(__dirname, 'auto_sync.js');
const IS_WINDOWS = os.platform() === 'win32';

// ---------------------------------------------------------
// HELPERS
// ---------------------------------------------------------

/** Run a shell command and return output. Throws on failure. */
function runCmd(command, cwd = process.cwd(), ignoreError = false) {
    try {
        return execSync(command, { cwd, stdio: 'pipe', encoding: 'utf8' }).trim();
    } catch (e) {
        if (!ignoreError) throw e;
        return null;
    }
}

/** Check if Tally is running */
function isTallyRunning() {
    try {
        const cmd = IS_WINDOWS ? 'tasklist' : 'ps aux';
        const output = runCmd(cmd);
        return /tally\.exe/i.test(output) || /tallyprime\.exe/i.test(output);
    } catch (e) {
        return false; // Assume not running if check fails
    }
}

/** Open URL in browser (cross-platform) */
function openUrl(url) {
    try {
        const start = IS_WINDOWS ? 'start' : 'open';
        exec(`${start} ${url}`);
    } catch (e) {
        Logger.error(`Failed to open URL: ${url}`);
    }
}

// ---------------------------------------------------------
// MAIN FLOW
// ---------------------------------------------------------
(async () => {
    Logger.header('BIZSTASH SMART LAUNCHER');

    // 1. GIT PULL (Update Code)
    // -----------------------------------------------------
    console.log('🔄 [1/4] Checking for updates (Git Pull)...');
    try {
        runCmd('git pull origin main');
        Logger.success('Code is up-to-date.');
    } catch (e) {
        const errorMsg = e.stderr || e.message || '';
        if (errorMsg.includes('authentication') || errorMsg.includes('denied') || errorMsg.includes('could not read Username')) {
            Logger.error('❌ AUTHTICATION FAILED');
            console.log('   The system cannot connect to GitHub. Your credentials might be expired.');
            console.log('   Opening GitHub login page for you...');
            await openUrl(AUTH_URL);

            console.log('\n   After logging in, please try running the sync again.');
            console.log('   (If using a token, you may need to update it in Windows Credential Manager)');
            process.exit(1);
        } else {
            Logger.warn('⚠ Git Pull failed (Offline? Merge conflict?). Continuing with local code...');
            Logger.debug(errorMsg);
        }
    }

    // 2. TALLY CHECK
    // -----------------------------------------------------
    console.log('\n🔍 [2/4] Checking Tally Prime...');
    if (!isTallyRunning()) {
        Logger.warn('⚠ Tally does not appear to be running!');
        console.log('   Please start Tally Prime and open your company.');
        console.log('   (Waiting 5 seconds before trying anyway...)');
        await new Promise(r => setTimeout(r, 5000));
    } else {
        Logger.success('Tally is running.');
    }

    // 3. RUN SYNC ENGINE
    // -----------------------------------------------------
    console.log('\n🚀 [3/4] Starting Sync Engine...');

    // Spawn child process to preserve colors and I/O
    const syncProcess = spawn('node', [SYNC_SCRIPT], { stdio: 'inherit', cwd: process.cwd() });

    syncProcess.on('close', async (code) => {
        if (code !== 0) {
            Logger.error(`\n❌ Sync failed with exit code ${code}.`);
            console.log('   Check the error details above.');
            console.log('   (Git Push will be skipped)');
            process.exit(code);
        }

        // 4. GIT PUSH (Upload Data)
        // -----------------------------------------------------
        console.log('\n☁ [4/4] Uploading Data to Cloud (Git Push)...');
        try {
            runCmd('git add .');
            // Check if there are changes to commit
            const status = runCmd('git status --porcelain');

            if (status) {
                const timestamp = new Date().toLocaleString().replace(',', '');
                runCmd(`git commit -m "Auto-Sync: ${timestamp}"`);
                runCmd('git push origin main');
                Logger.success('✅ Data uploaded to Bizstash Cloud.');
                Logger.header('ALL SYSTEMS GO - SYNC COMPLETE 🚀');
            } else {
                Logger.info('✨ No changes to upload.');
                Logger.header('SYNC COMPLETE (No changes) ✅');
            }
        } catch (e) {
            Logger.error('❌ Upload Failed (Git Push error)');
            const errorMsg = e.stderr || e.message || '';

            if (errorMsg.includes('authentication') || errorMsg.includes('denied')) {
                console.log('   Authentication expired. Opening browser...');
                await openUrl(AUTH_URL);
            } else {
                console.log(errorMsg);
            }
        }
    });

})();
