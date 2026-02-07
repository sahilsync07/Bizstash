# Data Sync Strategy: Analysis & Implementation Plan

**Date:** February 7, 2026  
**Status:** Planning Phase  
**Tally Instance:** localhost:9000 (READ-ONLY)  
**Objective:** Fetch required frontend data from Tally Prime 7, convert XML→JSON, with progressive/modular sync

---

## 1. CURRENT STATE ANALYSIS

### Existing Architecture
The project already has a **2-step sync system**:

1. **`fetch_tally_v2.js`** - Fetches XML from Tally
   - Gets Masters (all ledgers, groups, opening balances)
   - Detects company date range
   - Fetches vouchers by month (progressive batching)
   - Saves to `tally_data/xml/{company}/{date}/`

2. **`process_tally_v2.js`** - Converts XML→JSON
   - Parses masters to extract ledgers, groups, hierarchies
   - Processes vouchers to extract transactions
   - Calculates monthly stats, debtors, creditors, inventory
   - Outputs to `dashboard/public/data/{company}/data.json`

### What's Working Well ✅
- XML to JSON conversion using `xml2js`
- Progressive voucher fetching by month (prevents Tally overload)
- Proper transaction structure (double-entry bookkeeping)
- Masters processing (ledger hierarchy, opening balances)
- Monthly statistics aggregation
- Connection handling with timeouts

### Issues to Fix ⚠️
1. **"undefined" entries** - Some debtors/creditors get name "undefined"
2. **Missing lineman config** - Not fetched from Tally (hardcoded in App.jsx)
3. **Stock data gaps** - closing quantity/value not calculated properly
4. **Bill references incomplete** - openBills structure may have null/undefined
5. **Error recovery** - No retry logic for failed XML downloads
6. **Progress visibility** - No feedback on sync completion status

---

## 2. DATA FLOW ARCHITECTURE

```
┌──────────────┐
│ Tally Prime  │
│ (9000)       │ READ ONLY
└──────┬───────┘
       │
       ├─→ Masters Request (1 call)
       │   ├─ All Ledgers
       │   ├─ All Groups
       │   └─ Opening Balances
       │
       ├─→ Statistics Request (1 call)
       │   └─ Voucher counts by type
       │
       └─→ Vouchers (Progressive - Monthly batches)
           ├─ Month 1 vouchers
           ├─ Month 2 vouchers
           ├─ ... (with delays between)
           └─ Month N vouchers

       ↓ [All XML files saved]

┌──────────────────────┐
│ XML Parser Module    │
│ (xml2js)             │
└──────────┬───────────┘
           │
           ├─→ Parse Masters
           │   └─ Build ledger map, group hierarchy
           │
           ├─→ Parse Vouchers (by month)
           │   ├─ Extract transactions
           │   ├─ Calculate monthly stats
           │   └─ Track ledger movements
           │
           └─→ Aggregate Data
               ├─ Debtors analysis (aged buckets)
               ├─ Creditors analysis (bills)
               ├─ Stock movements (FSN)
               ├─ Ledger running balances
               └─ Lineman mapping

       ↓ [JSON structure assembled]

┌──────────────────────────────┐
│ JSON Output                  │
│ data.json (Frontend ready)   │
└──────────────────────────────┘
```

---

## 3. IMPLEMENTATION PLAN - 5 PHASES

### PHASE 1: Enhanced Fetch Strategy (Tally Read)
**Goal:** Robust, progressive data extraction with error handling

**Modules:**
1. **`tally-connector.js`** - Low-level Tally communication
   - POST XML to localhost:9000
   - Handle timeouts (10s default)
   - Retry logic (3 retries with exponential backoff)
   - Response validation (check for Tally error messages)

2. **`tally-fetch-masters.js`** - Master data
   - Single call to fetch all ledgers/groups
   - Parse and save to `tally_data/xml/{company}/masters.xml`
   - Extract: company name, date range, currency

3. **`tally-fetch-vouchers.js`** - Progressive voucher batching
   - **Step A:** Get company date range (call Statistics)
   - **Step B:** Calculate month buckets
   - **Step C:** Fetch each month sequentially with 2-3 sec delay between
   - **Step D:** Save to `tally_data/xml/{company}/vouchers/{YYYYMM}.xml`
   - **Step E:** Track progress to console/file

4. **`progress-tracker.js`** - Visibility into sync
   - Log progress: `[1/12 months done] 50 vouchers processed`
   - Track errors per month
   - Write to `tally_data/.sync_progress.json`

**Configuration:**
```javascript
const SYNC_CONFIG = {
  TALLY_URL: 'http://localhost:9000',
  REQUEST_TIMEOUT: 10000,        // 10 seconds
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 2000,             // 2 sec between retries
  BATCH_DELAY: 2500,             // 2.5 sec between month batches
  CHUNKS_PER_BATCH: 500,         // Max vouchers per fetch
  CONNECTION_POOL: 1             // Single connection (no keep-alive)
};
```

---

### PHASE 2: XML → JSON Parsing (Modular)
**Goal:** Convert Tally XML to structured JSON with validation

**Modules:**
1. **`xml-parser.js`** - XML parsing
   - Use `xml2js` with strict error handling
   - Validate XML structure
   - Return JS objects

2. **`masters-parser.js`** - Extract ledger hierarchy
   - Build ledger map: `{ ledgerName: { parent, group, openingBalance, rootGroup } }`
   - Build group map: `{ groupName: { parent, children[] } }`
   - Detect Debtors/Creditors groups

3. **`voucher-parser.js`** - Extract transactions & amounts
   - Parse each voucher into transaction object
   - Extract ledger entries (name, amount, +/-)
   - Extract inventory entries (item, qty, amount)
   - Validate double-entry bookkeeping

4. **`validator.js`** - Data quality checks
   - ✅ No "undefined" names
   - ✅ Transaction amounts sum to zero
   - ✅ All ledger names exist in master list
   - ✅ Dates in YYYYMMDD format
   - ✅ Stock quantities non-negative
   - ✅ Amounts are numbers

---

### PHASE 3: Analysis & Aggregation
**Goal:** Transform raw transactions into dashboard-ready metrics

**Modules:**
1. **`monthly-stats.js`** - Sales/Purchase by month
   - Input: all vouchers
   - Output: `{ "202604": { sales: X, purchase: Y }, ... }`

2. **`debtors-creditors.js`** - Party analysis
   - Calculate balances from opening + transactions
   - Age invoices (< 30, 30-60, 60-90, > 90 days)
   - Extract open bills with amounts and dates
   - Detect non-performing parties

3. **`inventory-analysis.js`** - Stock movements
   - Calculate inward/outward by item
   - Closing quantity & value (from inventory)
   - Last sale/purchase dates
   - Revenue per item
   - FSN categorization (calculated by frontend)

4. **`ledger-builder.js`** - Transaction journal
   - Build transaction array with all entries
   - Add running balances per ledger
   - Link to original voucher references

---

### PHASE 4: Output Assembly
**Goal:** Create final JSON matching frontend requirements

**Module: `data-assembler.js`**
```javascript
const finalData = {
  meta: {
    companyName: "...",
    lastUpdated: "ISO-8601"
  },
  linemanConfig: [ /* from config or hardcoded */ ],
  analysis: {
    monthlyStats: { /* from monthly-stats */ },
    debtors: [ /* from debtors-creditors */ ],
    creditors: [ /* from debtors-creditors */ ],
    stocks: [ /* from inventory-analysis */ ],
    transactions: [ /* from ledger-builder */ ],
    ledgersList: [ /* from masters */ ],
    ledgerOpenings: { /* from masters */ }
  }
};

// Write to dashboard/public/data/{company}/data.json
```

---

### PHASE 5: CI/CD Integration
**Goal:** Orchestrate entire workflow

**Master Script: `sync-v3.js`**
```javascript
async function main() {
  const company = await detectCompany(); // From Tally
  
  // Phase 1: Fetch
  await fetchMasters(company);
  await fetchVouchers(company); // Progressive!
  
  // Phase 2: Parse & Validate
  const parsed = await parseAllXML(company);
  const validated = await validateData(parsed);
  
  // Phase 3: Analyze
  const analysis = await aggregateAnalysis(validated);
  
  // Phase 4: Assemble
  const finalJson = assembleOutput(validated, analysis);
  
  // Phase 5: Write & Report
  await writeJSON(finalJson, company);
  await generateReport(company);
}
```

---

## 4. SYNC MODALITY - Qualitative & Quantitative

### Qualitative Checks (Data Quality)
```javascript
// In validator.js
const qualitativeChecks = {
  1: "No undefined/null names",
  2: "Amounts are valid numbers (not strings)",
  3: "Dates in YYYYMMDD format",
  4: "Double-entry bookkeeping balance (sum = 0)",
  5: "No duplicate transaction IDs (GUID)",
  6: "Party group names match lineman territories",
  7: "Stock quantities non-negative",
  8: "Invoice amounts positive",
  9: "Opening balances match ledger entries",
  10: "No corrupted XML elements"
};

// Report: PASS/FAIL for each check
```

### Quantitative Metrics (Performance & Volume)
```javascript
// In progress-tracker.js
const metrics = {
  masters: {
    ledgers_count: 150,
    groups_count: 25,
    groups_analyzed_time: "0.5s"
  },
  vouchers: {
    total_count: 5000,
    months_processed: 12,
    avg_time_per_month: "1.2s",
    errors_recovered: 2,
    final_time: "15.2s"
  },
  analysis: {
    debtors: 85,
    creditors: 45,
    stock_items: 320,
    transactions_stored: 5000,
    final_json_size: "2.3 MB"
  },
  overall: {
    start_time: "2026-02-07 10:30:00",
    end_time: "2026-02-07 10:46:30",
    total_duration: "16.5 minutes",
    status: "COMPLETE ✓"
  }
};
```

---

## 5. ERROR HANDLING & RECOVERY

### Error Scenarios & Responses

| Scenario | Response |
|----------|----------|
| Tally connection refused | Retry 3x with backoff, then abort |
| Timeout on large month | Increase timeout, retry with smaller batch |
| Malformed XML | Log error, skip that month, continue |
| Missing ledger in transaction | Log warning, use "Unknown" as fallback |
| Negative stock quantity | Log anomaly, take absolute value |
| Duplicate bill numbers | Keep latest, log duplicate |
| Network interrupted | Resume from last checkpoint |

---

## 6. IMPLEMENTATION ROADMAP

### Week 1:
- [ ] Create `tally-connector.js` with retry logic
- [ ] Create `tally-fetch-vouchers.js` with progressive batching
- [ ] Add progress tracker
- [ ] Test with Phase 1

### Week 2:
- [ ] Build all parser modules (Phase 2)
- [ ] Implement validator with all checks
- [ ] Test XML→JSON conversion

### Week 3:
- [ ] Build aggregation modules (Phase 3)
- [ ] Create data assembler (Phase 4)
- [ ] Full integration test

### Week 4:
- [ ] CI/CD integration
- [ ] Performance optimization
- [ ] Documentation & deployment

---

## 7. MODULAR STRUCTURE

```
bizstash/
├── sync/                          # NEW: Sync orchestration
│   ├── sync-v3.js                 # Main entry point
│   ├── config.js                  # Sync configuration
│   └── progress-tracker.js         # Logging
│
├── sync-modules/                  # NEW: Modular functions
│   ├── phase1-fetch/
│   │   ├── tally-connector.js
│   │   ├── tally-fetch-masters.js
│   │   └── tally-fetch-vouchers.js
│   │
│   ├── phase2-parse/
│   │   ├── xml-parser.js
│   │   ├── masters-parser.js
│   │   ├── voucher-parser.js
│   │   └── validator.js
│   │
│   ├── phase3-analyze/
│   │   ├── monthly-stats.js
│   │   ├── debtors-creditors.js
│   │   ├── inventory-analysis.js
│   │   └── ledger-builder.js
│   │
│   └── phase4-output/
│       └── data-assembler.js
│
└── tally_data/
    ├── xml/                       # Raw XML from Tally
    ├── .sync_progress.json        # Progress tracking
    └── .sync_errors.log           # Error log
```

---

## 8. KEY DESIGN PRINCIPLES

✅ **READ-ONLY** - Never write to Tally  
✅ **Progressive** - Batch requests to prevent Tally overload  
✅ **Modular** - Each phase independent and testable  
✅ **Resilient** - Retry logic, error recovery, checkpoints  
✅ **Transparent** - Clear progress logging and metrics  
✅ **Validated** - Qualitative checks before output  
✅ **Efficient** - Minimal memory, streaming where possible  

---

## 9. READY TO IMPLEMENT?

**Before starting Phase 1, confirm:**
1. ✅ Tally Prime 7 running on localhost:9000
2. ✅ Can POST XML requests to Tally (test in curl)
3. ✅ Directory structure for `tally_data/xml/` exists
4. ✅ Node.js modules installed (axios, xml2js, date-fns)
5. ✅ Dashboard data folder prepared for JSON output

**Next step:** Implement Phase 1 (Enhanced Fetch) with robust error handling and progressive batching.
