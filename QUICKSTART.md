# BIZSTASH Quick Start Guide

## 5-Minute Setup

### Prerequisites
- Node.js 14+ installed
- Tally Prime running on localhost:9000
- All dependencies installed: `npm install`

### Step 1: Start the Pipeline
```bash
node test-all-phases.js
```

### Step 2: Wait for Completion
- Expected time: ~10 minutes
- Tally remains stable throughout
- Console shows real-time progress

### Step 3: Find Your Reports
Reports are automatically generated in: `tally_data/reports/`

**Key Files**:
- `trial-balance.csv` - All accounts and balances
- `dashboard.html` - Open in browser for interactive view
- `executive-summary.txt` - Human-readable report

---

## Individual Phase Execution

### Just Fetch Data (5 min)
```bash
node test-phase1.js
```
Output: `tally_data/xml/`

### Just Parse (2 min)
```bash
node test-phase2.js
```
Output: `tally_data/json/`

### Just Analyze (instant)
```bash
node test-phase3.js
```
Output: `tally_data/analysis/`

### Just Generate Reports (instant)
```bash
node test-phase4.js
```
Output: `tally_data/reports/`

---

## Key Configuration

Edit `sync/config.js`:

```javascript
// Change Tally location (if not localhost:9000)
TALLY_URL: "http://192.168.1.100:9000"

// Slower fetching (for unstable connections)
BATCH_DELAY: 5.0        // Instead of 3.0
REQUEST_TIMEOUT: 300000 // Instead of 180000

// Change where data is saved
DATA_DIR: "/custom/path"
```

---

## Understanding the Output

### trial-balance.csv
```
Account Name,Category,Balance
Bank Account,Asset,50000
Accounts Payable,Liability,-30000
...
```

### dashboard.html
- Open in any web browser
- Shows financial summary
- Voucher type breakdown

### executive-summary.txt
```
FINANCIAL OVERVIEW
Assets:       1000000
Liabilities:   500000
Equity:        500000
...
```

---

## Common Issues & Fixes

| Problem | Fix |
|---------|-----|
| "Tally not responding" | Check `http://localhost:9000` works in browser |
| "Out of memory" | Run phases separately instead of all together |
| "No data appears" | Check Tally has data in requested date range |
| "Process takes too long" | Reduce `BATCH_DELAY` or run in production mode |

---

## Integration with Your Application

```javascript
const { runPhase1 } = require('./sync-modules/phase1-fetch/fetch-phase1');
const fs = require('fs-extra');

// Fetch data
const result = await runPhase1();

if (result.success) {
  // Data is in tally_data/xml/
  const xml = await fs.readFile('tally_data/xml/masters/masters.xml');
  // Process further...
}
```

---

## Monitoring

Watch the operation logs:
```bash
tail -f tally_data/reports/sync.log
```

Or view the most recent sync report:
```bash
cat tally_data/reports/SBE_Rayagada-sync-report-*.json | jq
```

---

## Next Run

Simply run again:
```bash
node test-all-phases.js
```

Previous data is automatically backed up, new data replaces it.

---

## Support

For detailed technical info, see: `DATA_SYNC_README.md`

For help: Check sync report in `tally_data/reports/`

---

**Status**: Production Ready ✅
**Last Tested**: 2025-01-07
**Next Review**: As needed
