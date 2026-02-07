const path = require('path');

const CONFIG = {
    TALLY_URL: 'http://localhost:9000',

    // Default directories (can be overridden)
    PATHS: {
        ROOT: path.resolve(__dirname, '..'), // sync/.. -> Bizstash root
        XML_DATA: path.resolve(__dirname, '..', 'tally_data', 'xml'),
        OUTPUT_DATA: path.resolve(__dirname, '..', 'dashboard', 'public', 'data')
    },

    // Linemen Configuration (Moved from process_tally_v2.js)
    LINEMEN: {
        'DEFAULT': [
            { name: "Sushant [Bobby]", lines: ["TIKIRI", "KASIPUR", "DURGI", "THERUBALI", "JK", "KALYAN SINGHPUR"], color: "bg-blue-500" },
            { name: "Dulamani Sahu", lines: ["BALIMELA", "CHITROKUNDA", "MALKANGIRI", "GUDARI", "GUNUPUR", "PARLAKHIMUNDI", "MUNIGUDA", "B.CTC", "PHULBAANI"], color: "bg-purple-500" },
            { name: "Aparna", lines: ["RAYAGADA", "LOCAL"], color: "bg-pink-500" },
            { name: "Raju", lines: ["JEYPUR", "PARVATHIPURAM", "KORAPUT", "SRIKAKULAM"], color: "bg-emerald-500" }
        ],
        // Mappings
        'SBE_Rayagada': 'DEFAULT',
        'Admin_Test_PC': 'DEFAULT'
    },

    // Sync Settings
    SETTINGS: {
        REQUEST_TIMEOUT: 300000,  // 300 seconds (5 mins) for SAFE Masters Fetch
        RETRY_ATTEMPTS: 3,
        COOLDOWN_MS: 1000,
        MONTH_CHUNKS: 1
    }
};

// Extended configuration for Phase 1 (Fetch) modules
CONFIG.DEFAULT_COMPANY = 'SBE_Rayagada';
CONFIG.DATA_DIR = path.resolve(__dirname, '..', 'tally_data');
CONFIG.TALLY_DATA_DIR = path.resolve(__dirname, '..', 'tally_data');
CONFIG.MASTERS_DIR = path.resolve(CONFIG.DATA_DIR, 'xml', 'masters');
CONFIG.VOUCHERS_DIR = path.resolve(CONFIG.DATA_DIR, 'xml', 'vouchers');
CONFIG.REPORTS_DIR = path.resolve(CONFIG.DATA_DIR, 'reports');
CONFIG.LOG_FILE = path.resolve(CONFIG.REPORTS_DIR, 'sync.log');

// Progressive fetch settings (CRITICAL for Tally stability)
CONFIG.BATCH_DELAY = 2.5; // seconds between monthly batch requests
CONFIG.REQUEST_TIMEOUT = 30000; // 30 seconds per Tally API call
CONFIG.RETRY_ATTEMPTS = 3;
CONFIG.RETRY_DELAY = 2; // initial retry delay in seconds
CONFIG.RETRY_BACKOFF = 1.5; // exponential backoff multiplier

// Connection pooling (set to false to prevent Tally overload)
CONFIG.HTTP_AGENT_KEEP_ALIVE = false;

// Logging and verbose mode
CONFIG.VERBOSE = true; // Set to false to suppress debug output

module.exports = CONFIG;
