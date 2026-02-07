/**
 * PROGRESS TRACKER - Logging, Progress Tracking, and Reporting
 * 
 * Provides:
 * - Colored console output
 * - Progress checkpoints
 * - Error tracking
 * - Sync report generation
 */

const fs = require('fs-extra');
const path = require('path');
const config = require('../../sync/config');

class ProgressTracker {
  constructor() {
    this.startTime = new Date();
    this.operations = [];
    this.errors = [];
    this.warnings = [];
    this.metrics = {
      mastersTime: 0,
      statisticsTime: 0,
      vouchersFetched: 0,
      vouchersProcessed: 0,
      totalTime: 0
    };
  }

  /**
   * Log message with color coding
   */
  log(message, level = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const colors = {
      info: '\x1b[36m',      // Cyan
      debug: '\x1b[90m',     // Gray
      success: '\x1b[32m',   // Green
      warn: '\x1b[33m',      // Yellow
      error: '\x1b[31m'      // Red
    };
    const reset = '\x1b[0m';
    const color = colors[level] || colors.info;

    const logEntry = {
      timestamp,
      level,
      message,
      time: new Date()
    };
    this.operations.push(logEntry);

    if (level === 'error') {
      this.errors.push(message);
    } else if (level === 'warn') {
      this.warnings.push(message);
    }

    if (config.VERBOSE) {
      console.log(`${color}[${timestamp}] ${level.toUpperCase()}: ${message}${reset}`);
    } else {
      // Always show errors, success, and info
      if (['error', 'success', 'info', 'warn'].includes(level)) {
        console.log(`${color}[${timestamp}] ${level.toUpperCase()}: ${message}${reset}`);
      }
    }

    // Write to log file
    this._writeToLogFile(logEntry);
  }

  /**
   * Track a metric
   */
  metric(name, value) {
    this.metrics[name] = value;
    this.log(`Metric: ${name} = ${value}`, 'debug');
  }

  /**
   * Start timing an operation
   */
  startTimer(name) {
    if (!this.timers) this.timers = {};
    this.timers[name] = Date.now();
    this.log(`Starting: ${name}`, 'debug');
  }

  /**
   * End timing and log duration
   */
  endTimer(name) {
    if (!this.timers || !this.timers[name]) {
      this.log(`Timer ${name} not started`, 'warn');
      return 0;
    }
    const duration = Date.now() - this.timers[name];
    this.metric(`${name}_duration`, duration);
    this.log(`✓ ${name} completed in ${(duration / 1000).toFixed(2)}s`, 'success');
    return duration;
  }

  /**
   * Write log to file
   */
  _writeToLogFile(entry) {
    try {
      const logDir = path.resolve(config.DATA_DIR || './tally_data', 'reports');
      fs.ensureDirSync(logDir);
      const logFile = path.resolve(logDir, 'sync.log');
      const line = `[${entry.timestamp}] ${entry.level.toUpperCase()}: ${entry.message}\n`;
      fs.appendFileSync(logFile, line);
    } catch (error) {
      // Silent fail for logging issues
    }
  }

  /**
   * Generate final sync report
   */
  generateReport(company, status = 'COMPLETE') {
    const endTime = new Date();
    const duration = Math.round((endTime - this.startTime) / 1000);
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;

    const report = {
      company,
      status,
      startTime: this.startTime.toISOString(),
      endTime: endTime.toISOString(),
      duration: `${minutes}m ${seconds}s`,
      totalOperations: this.operations.length,
      errors: this.errors.length,
      warnings: this.warnings.length,
      metrics: this.metrics,
      qualityScore: this.errors.length === 0 ? '100%' : `${Math.round((1 - this.errors.length / this.operations.length) * 100)}%`
    };

    if (config.VERBOSE) {
      console.log('\n' + '='.repeat(80));
      console.log('SYNC REPORT');
      console.log('='.repeat(80));
      console.log(`Company:       ${report.company}`);
      console.log(`Status:        ${report.status}`);
      console.log(`Duration:      ${report.duration}`);
      console.log(`Operations:    ${report.totalOperations}`);
      console.log(`Errors:        ${report.errors}`);
      console.log(`Warnings:      ${report.warnings}`);
      console.log(`Quality Score: ${report.qualityScore}`);
      console.log('='.repeat(80));
    }

    // Save report to file
    let reportFile = null;
    try {
      const reportDir = path.resolve(config.DATA_DIR || './tally_data', 'reports');
      fs.ensureDirSync(reportDir);
      reportFile = path.join(reportDir, `${company}-sync-report-${Date.now()}.json`);
      fs.writeJsonSync(reportFile, report, { spaces: 2 });
      this.log(`Report saved to ${reportFile}`, 'success');
    } catch (error) {
      this.log(`Failed to save report: ${error.message}`, 'error');
    }

    return {
      ...report,
      reportFile
    };
  }

  /**
   * Get error summary
   */
  getErrorSummary() {
    return {
      total: this.errors.length,
      errors: this.errors
    };
  }
}

// Singleton instance
let tracker = null;

function getInstance() {
  if (!tracker) {
    tracker = new ProgressTracker();
  }
  return tracker;
}

module.exports = {
  getInstance,
  log: (msg, level) => getInstance().log(msg, level),
  metric: (name, value) => getInstance().metric(name, value),
  startTimer: (name) => getInstance().startTimer(name),
  endTimer: (name) => getInstance().endTimer(name),
  generateReport: (company, status) => getInstance().generateReport(company, status),
  getErrorSummary: () => getInstance().getErrorSummary()
};
