const chalk = require('chalk');

class Logger {
    static _log(level, prefix, msg, colorFn) {
        const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
        // Console
        console.log(colorFn(prefix), msg);
        // File
        try {
            const fs = require('fs');
            fs.appendFileSync('sync.log', `[${timestamp}] [${level}] ${msg}\n`);
        } catch (e) { }
    }

    static info(msg) {
        this._log('INFO', 'ℹ  [INFO]   ', msg, require('chalk').blue);
    }

    static success(msg) {
        this._log('SUCCESS', '✅ [SUCCESS]', msg, require('chalk').green);
    }

    static warn(msg) {
        this._log('WARN', '⚠️ [WARN]   ', msg, require('chalk').yellow);
    }

    static error(msg, err = null) {
        this._log('ERROR', '❌ [ERROR]  ', msg, require('chalk').red);
        if (err) {
            console.error(require('chalk').red(err.stack || err.message));
            try {
                const fs = require('fs');
                fs.appendFileSync('sync.log', `[stacktrace] ${err.stack || err.message}\n`);
            } catch (e) { }
        }
    }

    static debug(msg) {
        if (process.env.DEBUG) {
            this._log('DEBUG', '🐞 [DEBUG]  ', msg, require('chalk').gray);
        }
    }

    static header(msg) {
        const chalk = require('chalk');
        console.log('\n' + chalk.bold.cyan('='.repeat(50)));
        console.log(chalk.bold.cyan(`   ${msg}`));
        console.log(chalk.bold.cyan('='.repeat(50)) + '\n');

        try {
            const fs = require('fs');
            fs.appendFileSync('sync.log', `\n=== ${msg} ===\n`);
        } catch (e) { }
    }
}

module.exports = Logger;
