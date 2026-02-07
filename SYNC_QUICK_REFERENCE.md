# Quick Reference: Data Sync Architecture

## 📑 Documents Overview

| Document | Purpose | For Whom |
|----------|---------|----------|
| **FRONTEND_DATA_REQUIREMENTS.md** | What data structure frontend needs | Frontend devs, API consumers |
| **SYNC_STRATEGY_SUMMARY.md** | High-level plan (read this first!) | Project managers, decision makers |
| **SYNC_STRATEGY_PLAN.md** | Detailed 5-phase plan | Backend devs starting implementation |
| **SYNC_TECHNICAL_DETAILS.md** | XML/JSON examples, error scenarios | Backend devs deep-diving code |
| **THIS FILE** | Quick reference during development | Everyone (bookmark this!) |

---

## 🎯 One-Sentence Mission
**Fetch data from Tally Prime 7 (localhost:9000) without crashing it, progressively convert XML→JSON matching frontend schema, and output ready-to-use data files.**

---

## 📊 Data Requirements at a Glance

**Frontend expects** → `dashboard/public/data/{company-id}/data.json`

```json
{
  "meta": {
    "companyName": "string",
    "lastUpdated": "ISO-8601 timestamp"
  },
  
  "linemanConfig": [
    { "name": "string", "lines": ["string"], "color": "string" }
  ],
  
  "analysis": {
    "monthlyStats": { "YYYYMM": { "sales": 0, "purchase": 0 } },
    "debtors": [ { "name", "balance", "status", "buckets", "openBills" } ],
    "creditors": [ { "name", "balance", "status", "buckets", "openBills" } ],
    "stocks": [ { "name", "qty", "value", "lastSaleDate", "revenue" } ],
    "transactions": [ { "date", "type", "number", "ledgers": [] } ],
    "ledgersList": [ "string" ],
    "ledgerOpenings": { "ledgerName": { "openingBalance", "parent", "rootGroup" } }
  }
}
```

**Minimum viable:**
- 1 company in companies.json
- 1 data.json with all empty arrays except monthlyStats
- Zero "undefined" entries

---

## 🔄 The 5-Phase Flow

```
┌─────────────────────────────────────────────────┐
│ PHASE 1: FETCH (from Tally)                     │
│ - Masters (1 request)                           │
│ - Statistics (1 request)                        │
│ - Vouchers (12 requests, 2.5s apart)            │
│ Output: XML files in tally_data/xml/            │
└──────────────────┬──────────────────────────────┘
                   │ (14 requests total, ~36 seconds)
┌──────────────────▼──────────────────────────────┐
│ PHASE 2: PARSE & VALIDATE                       │
│ - Parse XML with xml2js                         │
│ - Check: no "undefined", sums balance, format   │
│ Output: JS objects                              │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────┐
│ PHASE 3: ANALYZE                                │
│ - Calculate aged buckets (30/60/90/90+ days)    │
│ - Extract invoices                              │
│ - Compute balances                              │
│ Output: Aggregated metrics                      │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────┐
│ PHASE 4: ASSEMBLE                               │
│ - Combine all data into single JSON             │
│ - Write to dashboard/public/data/{co}/data.json │
│ Output: data.json ready for frontend            │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────┐
│ PHASE 5: REPORT                                 │
│ - Generate sync report                          │
│ - Update companies.json lastUpdated             │
│ Output: Sync complete message                   │
└─────────────────────────────────────────────────┘
```

---

## ⚙️ Critical Configuration

```javascript
// In sync/config.js
const SYNC_CONFIG = {
  // Tally Connection
  TALLY_URL: 'http://localhost:9000',
  REQUEST_TIMEOUT: 10000,           // 10 seconds
  
  // Retry Strategy
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 2000,                // 2 sec between retries
  RETRY_BACKOFF: 1.5,               // Exponential: 2s, 3s, 4.5s
  
  // Progressive Batching
  BATCH_DELAY: 2500,                // 2.5 sec between months
  CHUNKS_PER_BATCH: 500,            // Max 500 vouchers per fetch
  
  // Files
  TALLY_DATA_DIR: 'tally_data',
  OUTPUT_DIR: 'dashboard/public/data',
  
  // Logging
  VERBOSE: true,
  LOG_FILE: 'tally_data/.sync.log'
};
```

---

## 🚨 Non-Negotiable Rules

1. **READ-ONLY**: Only POST requests to Tally. Never POST data that writes to Tally.
   ```javascript
   // ✓ Safe
   const xml = `<ENVELOPE><HEADER><TALLYREQUEST>Export Data</TALLYREQUEST>...`;
   
   // ✗ Forbidden
   const xml = `<ENVELOPE><HEADER><TALLYREQUEST>Create Company</TALLYREQUEST>...`;
   ```

2. **Progressive Loading**: Never fetch all vouchers at once.
   ```javascript
   // ✓ Safe
   for (month of months) {
     fetch(month);
     await sleep(2500);
   }
   
   // ✗ Forbidden
   Promise.all(months.map(m => fetch(m))); // Too fast!
   ```

3. **Validation First**: Never output data without validation.
   ```javascript
   // ✓ Safe
   const validated = validate(data);
   if (validated.errors.length > 0) throw new Error("Validation failed");
   
   // ✗ Forbidden
   const json = JSON.stringify(data);
   ```

4. **Error Handling**: Skip bad data, don't crash.
   ```javascript
   // ✓ Safe
   try { fetchMonth(m); } catch (e) { log(e); continue; }
   
   // ✗ Forbidden
   await fetchMonth(m); // No try-catch = crash on error
   ```

---

## 📁 File Structure

```
Bizstash/
├── sync/                                    ← Orchestration
│   ├── sync-v3.js                           ← Main entry point
│   ├── config.js                            ← Settings
│   └── progress-tracker.js                  ← Logging
│
├── sync-modules/                            ← Implementation modules
│   ├── phase1-fetch/
│   │   ├── tally-connector.js               ← Low-level HTTP
│   │   ├── fetch-masters.js
│   │   └── fetch-vouchers.js                ← Progressive batching
│   ├── phase2-parse/
│   │   ├── xml-parser.js
│   │   ├── masters-parser.js
│   │   ├── voucher-parser.js
│   │   └── validator.js                     ← Quality checks
│   ├── phase3-analyze/
│   │   ├── monthly-stats.js
│   │   ├── debtors-creditors.js
│   │   ├── inventory-analysis.js
│   │   └── ledger-builder.js
│   └── phase4-output/
│       └── data-assembler.js
│
├── dashboard/
│   ├── public/
│   │   └── data/
│   │       ├── companies.json               ← List of companies
│   │       ├── {company}/data.json          ← Actual data
│   │       └── ...
│   └── src/
│       └── App.jsx                          ← Frontend (read this for needed fields)
│
├── tally_data/
│   ├── xml/
│   │   ├── masters.xml
│   │   ├── vouchers/
│   │   │   ├── 202404.xml
│   │   │   ├── 202405.xml
│   │   │   └── ...
│   │   └── .sync_progress.json              ← Checkpoint tracking
│   └── .sync_errors.log                     ← Error log
│
├── FRONTEND_DATA_REQUIREMENTS.md            ← Data schema
├── SYNC_STRATEGY_SUMMARY.md                 ← High-level plan
├── SYNC_STRATEGY_PLAN.md                    ← Detailed plan (5 phases)
├── SYNC_TECHNICAL_DETAILS.md                ← Examples & error scenarios
└── SYNC_QUICK_REFERENCE.md                  ← This file
```

---

## 🧪 Testing Checklist

### Before Phase 1
- [ ] Tally Prime 7 running on localhost:9000
- [ ] Can ping: `curl -X POST http://localhost:9000 -d "test"`
- [ ] Directory `tally_data/xml/` exists and is writable
- [ ] Node.js modules installed: `npm install`

### During Phase 1 (Fetch)
- [ ] Test fetch-masters: 1 call, get < 10 seconds
- [ ] Test fetch-statistics: 1 call, see voucher counts
- [ ] Test fetch-one-month: 1 call, get XML file
- [ ] Verify 2.5s delays between requests
- [ ] Check retry logic: simulate network failure

### During Phase 2 (Parse)
- [ ] Parse masters.xml → JS object
- [ ] Parse voucher.xml → transactions
- [ ] Validate: no "undefined" names
- [ ] Validate: transaction amounts balance

### During Phase 3 (Analyze)
- [ ] Calculate monthly stats
- [ ] Age debtors into buckets
- [ ] Build ledger running balances
- [ ] Extract inventory data

### During Phase 4 (Assemble)
- [ ] JSON matches schema exactly
- [ ] All required fields present
- [ ] No extra fields
- [ ] Valid JSON (parse-able)

### End-to-End
- [ ] Full sync completes in < 30 seconds
- [ ] Dashboard loads JSON
- [ ] Dashboard displays data without errors
- [ ] Sync report shows 100% quality score

---

## 🐛 Common Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| "undefined" in party names | Tally returned empty NAME | Validate in Phase 2, reject entry |
| Timeout on fetch | Month has too many vouchers | Increase TIMEOUT to 15s |
| XML parse error | Malformed XML from Tally | Log error, skip month, continue |
| Stock value is zero | Closing qty not from Tally | Calculate from inward-outward |
| Missing openBills | Invoices not extracted | Map from transaction ledger entries |
| Ledger balance mismatch | Opening balance wrong | Verify masters data from Tally |
| Concurrent requests crash Tally | Too many simultaneous fetches | Enforce BATCH_DELAY (2.5s minimum) |

---

## 📈 Performance Targets

```
Phase 1 (Fetch):       10-15 seconds (14 Tally requests)
Phase 2 (Parse):        1-2 seconds (XML → JS)
Phase 3 (Analyze):      1-2 seconds (aggregations)
Phase 4 (Assemble):     0.5 seconds (JSON write)
Phase 5 (Report):       0.5 seconds (logging)
─────────────────────────────────────
TOTAL:                 13-20 seconds (for full year sync)

Memory usage:          < 500 MB (no streaming needed)
JSON output size:      2-5 MB (per company)
```

---

## 📞 Key Functions (Pseudocode)

```javascript
// Phase 1
async function main() {
  await fetchMasters();           // 1 call
  const range = await detectRange(); // 1 call
  await fetchVouchersByMonth(range); // 12+ calls, 2.5s apart
}

// Phase 2
async function parseAndValidate() {
  const masters = await parseMasters();
  const vouchers = await parseVouchers();
  return validate({ masters, vouchers });
}

// Phase 3
async function analyze(parsed) {
  return {
    monthlyStats: aggregateMonths(parsed.vouchers),
    debtors: analyzeDebtors(parsed.masters, parsed.vouchers),
    creditors: analyzeCreditors(parsed.masters, parsed.vouchers),
    stocks: analyzeInventory(parsed.vouchers),
    transactions: extractTransactions(parsed.vouchers),
    ledgersList: parsed.masters.ledgers,
    ledgerOpenings: parsed.masters.openings
  };
}

// Phase 4
async function assemble(analysis) {
  return {
    meta: { companyName, lastUpdated: new Date().toISOString() },
    linemanConfig: HARDCODED_CONFIG,
    analysis
  };
}

// Phase 5
async function writeAndReport(data, company) {
  await fs.writeJson(`dashboard/public/data/${company}/data.json`, data);
  await updateCompanies(company);
  await generateReport();
}
```

---

## 🎯 What's Next?

**Immediate (Today):**
1. Read SYNC_STRATEGY_SUMMARY.md
2. Read this Quick Reference
3. Review sync/config.js requirements

**This Week:**
1. Implement Phase 1 (tally-connector.js, fetch-vouchers.js)
2. Test with real Tally connection
3. Verify progressive batching works

**Next Week:**
1. Implement Phase 2 (parsers, validators)
2. Test XML → JSON conversion
3. Validate data quality

**Following Week:**
1. Implement Phase 3-5
2. Full integration test
3. Performance optimization

---

## 📚 Related Files to Read

1. **frontend/src/App.jsx** - See what data fields it actually uses (line 82+)
2. **fetch_tally_v2.js** - Existing fetch code (good reference)
3. **process_tally_v2.js** - Existing parser code (good reference)
4. **dashboard/public/data/Admin_Test_PC/data.json** - Example output format

---

## ❓ FAQ

**Q: Will fetching data crash Tally?**  
A: No, if we follow progressive batching (2.5s between months, max 500 vouchers per batch).

**Q: How long does full sync take?**  
A: 15-20 seconds for a full year of data.

**Q: What if a month fails?**  
A: Log the error, skip that month, continue processing. Sync report will show which months failed.

**Q: How do we know if data quality is good?**  
A: Run validation checks. Report should show 100% pass rate before writing JSON.

**Q: Can we run sync multiple times?**  
A: Yes! It's idempotent. Same data, same result (overwrites previous JSON).

**Q: Do we need to write to Tally?**  
A: No! Only READ (Export) requests. Never write.

---

## ✅ Success Criteria

When you're done:
- [ ] Tally connection doesn't crash
- [ ] All XML converts to JSON properly
- [ ] No "undefined" entries in output
- [ ] Frontend loads and displays data
- [ ] Dashboard shows correct company info
- [ ] Sync completes in < 30 seconds
- [ ] All 5 phases can run independently

---

**Last Updated:** February 7, 2026  
**Status:** Ready for Phase 1 Implementation  
**Next Action:** Implement sync/sync-v3.js main orchestration file
