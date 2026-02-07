# 📊 Visual Architecture Diagrams

## 1. Complete Data Flow Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                      BIZSTASH DATA SYNC SYSTEM                  │
└─────────────────────────────────────────────────────────────────┘

╔═══════════════════════════════════════════════════════════════════╗
║                   TALLY PRIME 7 (localhost:9000)                 ║
║                         [READ ONLY]                              ║
╚═════════════════════════╤═══════════════════════════════════════╝
                          │
                          │  POST XML Requests
                          │  ├─ Masters (1)
                          │  ├─ Statistics (1)
                          │  └─ Vouchers (12 with delays)
                          │
┌─────────────────────────▼──────────────────────────────────────┐
│                    PHASE 1: FETCH                               │
│  sync-modules/phase1-fetch/                                     │
│  ├─ tally-connector.js        [HTTP + Retry Logic]             │
│  ├─ fetch-masters.js          [Single call]                    │
│  └─ fetch-vouchers.js         [Progressive 2.5s delays]        │
│                                                                  │
│  Output: XML files in tally_data/xml/                          │
│  ├─ masters.xml                                                │
│  └─ vouchers/202404.xml, 202405.xml, ...                       │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           │  ~36 seconds
                           │  (14 Tally requests)
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                    PHASE 2: PARSE & VALIDATE                    │
│  sync-modules/phase2-parse/                                     │
│  ├─ xml-parser.js             [xml2js parsing]                 │
│  ├─ masters-parser.js         [Extract ledgers/groups]         │
│  ├─ voucher-parser.js         [Extract transactions]           │
│  └─ validator.js              [10 quality checks]              │
│                                                                  │
│  Validations:                                                   │
│  ✓ No "undefined" names       ✓ Dates YYYYMMDD format          │
│  ✓ Valid numbers              ✓ Transaction balance (Dr=Cr)    │
│  ✓ No corrupted XML           ✓ Stock qty non-negative        │
│                                                                  │
│  Output: Validated JS objects                                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           │  ~2 seconds
                           │  (Full XML → validated JS)
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                    PHASE 3: ANALYZE                             │
│  sync-modules/phase3-analyze/                                   │
│  ├─ monthly-stats.js          [Sales/Purchase by month]        │
│  ├─ debtors-creditors.js      [Parties + aged buckets]         │
│  ├─ inventory-analysis.js     [Stock movements]                │
│  └─ ledger-builder.js         [Transaction journal]            │
│                                                                  │
│  Calculations:                                                  │
│  ├─ Age invoices (<30, 30-60, 60-90, >90 days)                │
│  ├─ Extract open bills per party                               │
│  ├─ Calculate stock closing values                             │
│  └─ Build ledger running balances                              │
│                                                                  │
│  Output: Aggregated metrics                                    │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           │  ~2 seconds
                           │  (All aggregations)
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                    PHASE 4: ASSEMBLE                            │
│  sync-modules/phase4-output/                                    │
│  └─ data-assembler.js         [Combine all data]               │
│                                                                  │
│  Assemble JSON:                                                 │
│  ├─ meta (companyName, lastUpdated)                            │
│  ├─ linemanConfig (sales territories)                          │
│  └─ analysis                                                    │
│      ├─ monthlyStats        (12 months of sales/purchase)      │
│      ├─ debtors             (85 parties with aged buckets)      │
│      ├─ creditors           (42 suppliers with bills)           │
│      ├─ stocks              (320 inventory items)               │
│      ├─ transactions        (5000 journal entries)              │
│      ├─ ledgersList         (152 account names)                │
│      └─ ledgerOpenings      (opening balances)                 │
│                                                                  │
│  Output: dashboard/public/data/{company}/data.json             │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           │  ~0.5 seconds
                           │  (JSON write)
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                    PHASE 5: REPORT                              │
│  sync/progress-tracker.js                                       │
│                                                                  │
│  Generate Report:                                               │
│  ├─ Total records processed                                    │
│  ├─ Quality checks passed (100%)                               │
│  ├─ Total duration (13-20 seconds)                             │
│  └─ Update companies.json lastUpdated                          │
│                                                                  │
│  Output: .sync_progress.json, console log                      │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           │  ~0.5 seconds
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│        ✅ SYNC COMPLETE - READY FOR FRONTEND                   │
│                                                                  │
│  dashboard/ loads data.json and renders to user ✨              │
└──────────────────────────────────────────────────────────────────┘

TOTAL TIME: 13-20 seconds (full year sync)
MEMORY USAGE: < 500 MB
OUTPUT SIZE: 2-5 MB per company
```

---

## 2. Progressive Batching Strategy

```
PROBLEM: Fetching all vouchers at once crashes Tally
└─ Too much data (50+ MB in single response)
└─ Network timeout
└─ Memory overflow

SOLUTION: Progressive Monthly Batching

Timeline (Apr 2024 - Mar 2025):
───────────────────────────────────────────────────

Apr 2024    [FETCH]──→ [PARSE] ─→ ✓ 412 vouchers (1.2s)
               │
               └─ Wait 2.5s
                    │
May 2024    [FETCH]──→ [PARSE] ─→ ✓ 468 vouchers (1.2s)
               │
               └─ Wait 2.5s
                    │
Jun 2024    [FETCH]──→ [PARSE] ─→ ✓ 435 vouchers (1.2s)
               │
               └─ Wait 2.5s
                    │
...           ...
                    │
Mar 2025    [FETCH]──→ [PARSE] ─→ ✓ 389 vouchers (1.2s)
               │
               └─ Done (no more delays)

TOTAL: 12 fetches × 1.2s + 11 delays × 2.5s = ~36 seconds

RESULT: Tally stays responsive, never overloaded ✓
```

---

## 3. Data Transformation Pipeline (Detail)

```
STEP 1: RAW XML FROM TALLY
────────────────────────────────────────────────
<VOUCHER VOUCHERTYPENAME="Sales" NUMBER="SJ-001">
  <DATE>20240401</DATE>
  <ALLLEDGERENTRIES.LIST>
    <LEDGERENTRY>
      <LEDGERNAME>ABC Trading</LEDGERNAME>
      <AMOUNT>100000.00</AMOUNT>
    </LEDGERENTRY>
    <LEDGERENTRY>
      <LEDGERNAME>Revenue</LEDGERNAME>
      <AMOUNT>-100000.00</AMOUNT>
    </LEDGERENTRY>
  </ALLLEDGERENTRIES.LIST>
</VOUCHER>

                    │
                    │ xml2js.parseString()
                    ▼

STEP 2: PARSED JS OBJECT
────────────────────────────────────────────────
{
  VOUCHER: {
    $: { VOUCHERTYPENAME: "Sales", NUMBER: "SJ-001" },
    DATE: "20240401",
    ALLLEDGERENTRIES: {
      LIST: [
        { LEDGERNAME: "ABC Trading", AMOUNT: "100000.00" },
        { LEDGERNAME: "Revenue", AMOUNT: "-100000.00" }
      ]
    }
  }
}

                    │
                    │ validator.check()
                    ▼

STEP 3: VALIDATED
────────────────────────────────────────────────
✓ Names valid (no "undefined")
✓ Amounts balance (100000 + -100000 = 0)
✓ Dates YYYYMMDD format
✓ No type errors

                    │
                    │ normalize()
                    ▼

STEP 4: NORMALIZED TRANSACTION
────────────────────────────────────────────────
{
  date: "20240401",
  number: "SJ-001",
  type: "Sales",
  ledgers: [
    { name: "ABC Trading", amount: 100000 },
    { name: "Revenue", amount: -100000 }
  ]
}

                    │
                    │ aggregateMonthlyStats()
                    │ analyzeDebtors()
                    │ analyzeInventory()
                    ▼

STEP 5: AGGREGATED METRICS
────────────────────────────────────────────────
{
  monthlyStats: {
    "202404": { sales: 100000, purchase: 0 }
  },
  
  debtors: [{
    name: "ABC Trading",
    balance: 100000,
    status: "Performing",
    buckets: { days30: 100000, days60: 0, ... },
    openBills: [
      { name: "SJ-001", date: "20240401", amount: 100000 }
    ]
  }],
  
  ledgerBalances: {
    "ABC Trading": 100000,
    "Revenue": -100000
  }
}

                    │
                    │ assembleOutput()
                    ▼

STEP 6: FINAL JSON (FRONTEND READY)
────────────────────────────────────────────────
{
  "meta": {
    "companyName": "SBE Rayagada",
    "lastUpdated": "2026-02-07T10:46:30.123Z"
  },
  "linemanConfig": [ ... ],
  "analysis": {
    "monthlyStats": { ... },
    "debtors": [ ... ],
    "creditors": [ ... ],
    "stocks": [ ... ],
    "transactions": [ ... ],
    "ledgersList": [ ... ],
    "ledgerOpenings": { ... }
  }
}

              ✓ READY FOR DASHBOARD ✓
```

---

## 4. Validation Checkpoint

```
BEFORE OUTPUT → QUALITY GATES → AFTER OUTPUT

   Raw Data              Validation              Clean Data
   (From Tally)          (10 Checks)             (To Frontend)
        │                    │                        │
        │                    │                        │
    5000 txns         ✓ No "undefined"            5000 txns
    85 debtors   ──→  ✓ Valid numbers      ───→  85 debtors
    320 stocks        ✓ Format YYYYMMDD          320 stock
    ...               ✓ Balance Dr=Cr            ...
                      ✓ No duplicates
                      ✓ Stock qty ≥ 0
                      ✓ Amounts numeric
                      ✓ Ledger exists
                      ✓ Groups match
                      ✓ No corruption
                      
              QUALITY SCORE: 100% ✓
                OR REJECT ✗

If ANY check fails:
├─ Log error with detail
├─ Mark data as rejected
└─ DO NOT output to JSON
```

---

## 5. Module Dependency Graph

```
                          ┌─────────────────┐
                          │  sync/sync-v3   │
                          │  (Main Entry)   │
                          └────────┬────────┘
                                   │
                ┌──────────────────┼──────────────────┐
                │                  │                  │
                ▼                  ▼                  ▼
        ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
        │   Phase 1    │   │   Phase 2    │   │   Phase 3    │
        │    FETCH     │   │ PARSE & VAL  │   │   ANALYZE    │
        └──────────────┘   └──────────────┘   └──────────────┘
                │                  │                  │
        ┌───────┼───────┐      │                ┌────┼────┬───┐
        │       │       │      │                │    │    │   │
        ▼       ▼       ▼      ▼                ▼    ▼    ▼   ▼
      fetch- fetch- tally-  xml-   masters- voucher- monthly debtors
      masters vouchers conn  parser parser parser stats creditor
                              │      │       │
                              └──────┼───────┘
                                     │
                                  validator

                                     │
                    ┌────────────────┼────────────────┐
                    │                                 │
                    ▼                                 ▼
            (If valid)                        (If invalid)
            Phase 4: Assemble ────────→ Log Error, Skip
            data-assembler.js
                    │
                    ▼
            Phase 5: Report
            progress-tracker.js
                    │
                    ▼
            ✅ JSON Ready OR ❌ Rejected
```

---

## 6. Error Recovery Flow

```
REQUEST TO TALLY
      │
      ▼
  [ATTEMPT 1]
      │
      ├─ Success ───────────────────→ Continue
      │
      └─ Timeout/Error
           │
           ▼
       Wait 2s
           │
           ▼
       [ATTEMPT 2]
           │
           ├─ Success ───────────────→ Continue
           │
           └─ Timeout/Error
                │
                ▼
            Wait 3s (1.5x backoff)
                │
                ▼
            [ATTEMPT 3]
                │
                ├─ Success ──────────→ Continue
                │
                └─ Timeout/Error
                     │
                     ▼
                 Log Error
                 Skip Month
                 Continue to Next Month
                 Note in Report
```

---

## 7. File Size Progression

```
TALLY STORED DATA:
├─ Masters XML:           ~1 MB   (150 ledgers, 25 groups)
├─ Vouchers XML (12 mo):  ~48 MB  (5000 transactions)
└─ Total:                 ~49 MB  (stays under limits)

         │
         │ Parsing + Aggregation
         ▼

PROCESSED DATA:
├─ Masters JS object:     ~0.5 MB
├─ Vouchers JS array:     ~3.0 MB
├─ Analysis metrics:      ~1.5 MB
└─ Total:                 ~5.0 MB

         │
         │ JSON Stringify + Write
         ▼

FINAL OUTPUT:
└─ data.json:             ~2.3 MB  (compressed JSON)

MEMORY DURING SYNC:
├─ Peak usage:            ~450 MB (all in memory)
├─ Acceptable:            < 1 GB (modern systems)
└─ Streaming needed:      No (single-pass processing)
```

---

## 8. Timeline Visualization

```
HOUR 0:00  ╔═ Sync Start
           ║
HOUR 0:00-0:15  ║
           │
           │ ╠═ Phase 1: FETCH (14 Tally requests)
           │ ║  ├─ Masters
           │ ║  ├─ Statistics  
           │ ║  └─ Vouchers × 12 (with 2.5s delays)
           │ ║
HOUR 0:15-0:17  │ ║
           │ ╠═ Phase 2: PARSE & VALIDATE
           │ ║  ├─ XML → JS
           │ ║  ├─ 10 quality checks
           │ ║  └─ Log any errors
           │ ║
HOUR 0:17-0:19  │ ╠═ Phase 3: ANALYZE
           │ ║  ├─ Monthly stats
           │ ║  ├─ Debtors + aged buckets
           │ ║  ├─ Creditors + bills
           │ ║  ├─ Stock movements
           │ ║  └─ Ledger balances
           │ ║
HOUR 0:19-0:19  │ ╠═ Phase 4: ASSEMBLE
           │ ║  └─ Combine into single JSON
           │ ║
HOUR 0:19-0:20  │ ╠═ Phase 5: REPORT
           │ ║  ├─ Generate sync summary
           │ ║  ├─ Update companies.json
           │ ║  └─ Log success/errors
           │ ║
HOUR 0:20  ║═ Sync Complete ✓
           ║
           ╚═ Dashboard loads JSON, renders data

TOTAL: 20 seconds (< 1 minute!)
```

---

## 9. System Architecture Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                   BIZSTASH SYSTEM                            │
└──────────────────────────────────────────────────────────────┘

┌─────────────────┐         ┌──────────────────────┐
│ Tally Prime 7   │─────────│   Sync Pipeline      │
│ (localhost:9000)│         │  (Node.js process)   │
│   [Company]     │         │                      │
│   [Ledgers]     │         │  ├─ Phase 1-5        │
│   [Vouchers]    │ READ    │  ├─ Modules          │
│                 │ ONLY    │  └─ Validation       │
└─────────────────┘         └──────────────────────┘
                                     │
                                     │
                            ┌────────▼────────┐
                            │   Raw Files     │
                            │                 │
                            │ tally_data/     │
                            │ ├─ xml/         │
                            │ │  ├─ masters   │
                            │ │  ├─ vouchers  │
                            │ │  └─ logs      │
                            │ └─ reports/     │
                            └────────┬────────┘
                                     │
                                     │
                            ┌────────▼────────┐
                            │  Dashboard      │
                            │   Public Data   │
                            │                 │
                            │ public/data/    │
                            │ ├─ companies.   │
                            │ │  json         │
                            │ └─ {company}/   │
                            │    data.json ✓  │
                            └────────┬────────┘
                                     │
                                     │
                            ┌────────▼────────┐
                            │  React Frontend │
                            │                 │
                            │  Dashboard.jsx  │
                            │  ├─ Charts      │
                            │  ├─ Tables      │
                            │  └─ Metrics     │
                            └─────────────────┘
                                     │
                                     ▼
                            👤 User sees data! ✨
```

---

**These diagrams show:**
✓ How data flows from Tally → JSON → Dashboard  
✓ Why progressive batching is necessary  
✓ How validation prevents bad data  
✓ What modules depend on what  
✓ How errors are recovered  
✓ File size and memory usage  
✓ Overall timeline (20 seconds)  
✓ System architecture  

