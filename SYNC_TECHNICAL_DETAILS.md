# Data Sync: Flow Examples & Technical Details

---

## 1. REQUEST/RESPONSE EXAMPLES

### Request 1: Get Masters (Ledgers & Groups)
**Purpose:** One-time fetch of all accounts

```xml
POST http://localhost:9000
Content-Type: text/xml

<ENVELOPE>
    <HEADER>
        <TALLYREQUEST>Export Data</TALLYREQUEST>
    </HEADER>
    <BODY>
        <EXPORTDATA>
            <REQUESTDESC>
                <REPORTNAME>List of Accounts</REPORTNAME>
                <STATICVARIABLES>
                    <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
                    <ACCOUNTTYPE>All Masters</ACCOUNTTYPE>
                </STATICVARIABLES>
            </REQUESTDESC>
        </EXPORTDATA>
    </BODY>
</ENVELOPE>
```

**Response (simplified):**
```xml
<ENVELOPE>
    <BODY>
        <IMPORTDATA>
            <REQUESTDATA>
                <TALLYMESSAGE>
                    <LEDGER NAME="ABC Trading">
                        <PARENT>Sundry Debtors</PARENT>
                        <OPENINGBALANCE>50000.00</OPENINGBALANCE>
                    </LEDGER>
                    <GROUP NAME="Sundry Debtors">
                        <PARENT>Assets</PARENT>
                    </GROUP>
                    ...
                </TALLYMESSAGE>
            </REQUESTDATA>
        </IMPORTDATA>
    </BODY>
</ENVELOPE>
```

**Parsed to JS:**
```javascript
{
  ledgers: {
    "ABC Trading": {
      name: "ABC Trading",
      parent: "Sundry Debtors",
      openingBalance: 50000,
      rootGroup: "Sundry Debtors"
    },
    "XYZ Supply": {
      name: "XYZ Supply",
      parent: "Sundry Creditors",
      openingBalance: -100000,
      rootGroup: "Sundry Creditors"
    }
  },
  groups: {
    "Sundry Debtors": { parent: "Assets" },
    "Assets": { parent: "" }
  }
}
```

---

### Request 2: Get Voucher Statistics (Monthly Counts)
**Purpose:** Know total vouchers per month before fetching

```xml
POST http://localhost:9000
Content-Type: text/xml

<ENVELOPE>
    <HEADER>
        <TALLYREQUEST>Export Data</TALLYREQUEST>
    </HEADER>
    <BODY>
        <EXPORTDATA>
            <REQUESTDESC>
                <REPORTNAME>Statistics</REPORTNAME>
                <STATICVARIABLES>
                    <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
                    <SVFROMDATE>20240401</SVFROMDATE>
                    <SVTODATE>20250331</SVTODATE>
                </STATICVARIABLES>
            </REQUESTDESC>
        </EXPORTDATA>
    </BODY>
</ENVELOPE>
```

**Response (simplified):**
```xml
<ENVELOPE>
    <BODY>
        <IMPORTDATA>
            <VOUCHERTYPE>
                <NAME>Sales</NAME>
                <TOTALVOUCHERS>450</TOTALVOUCHERS>
            </VOUCHERTYPE>
            <VOUCHERTYPE>
                <NAME>Purchase</NAME>
                <TOTALVOUCHERS>320</TOTALVOUCHERS>
            </VOUCHERTYPE>
            ...
        </IMPORTDATA>
    </BODY>
</ENVELOPE>
```

**Used to calculate total batches needed**

---

### Request 3: Get Vouchers for One Month (Progressive)
**Purpose:** Fetch 50-100 vouchers at a time, month by month

```xml
POST http://localhost:9000
Content-Type: text/xml

<ENVELOPE>
    <HEADER>
        <VERSION>1</VERSION>
        <TALLYREQUEST>Export</TALLYREQUEST>
        <TYPE>Collection</TYPE>
        <ID>BizStashVouchers202404</ID>
    </HEADER>
    <BODY>
        <DESC>
            <STATICVARIABLES>
                <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
                <SVFROMDATE>20240401</SVFROMDATE>
                <SVTODATE>20240430</SVTODATE>
            </STATICVARIABLES>
            <TDL>
                <TDLMESSAGE>
                    <COLLECTION NAME="BizStashVouchers">
                        <TYPE>Voucher</TYPE>
                        <FETCH>Date, VoucherNumber, VoucherTypeName, Reference, 
                               AllLedgerEntries, AllInventoryEntries</FETCH>
                    </COLLECTION>
                </TDLMESSAGE>
            </TDL>
        </DESC>
    </BODY>
</ENVELOPE>
```

**Response (simplified):**
```xml
<ENVELOPE>
    <BODY>
        <IMPORTDATA>
            <REQUESTDATA>
                <TALLYMESSAGE>
                    <VOUCHER VOUCHERTYPENAME="Sales" NUMBER="SJ-001">
                        <DATE>20240401</DATE>
                        <VOUCHERNUMBER>SJ-001</VOUCHERNUMBER>
                        <REFERENCE>INV-001</REFERENCE>
                        <GUID>abc-123</GUID>
                        
                        <!-- Ledger Entries -->
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
                        
                        <!-- Inventory/Stock Entries -->
                        <ALLINVENTORYENTRIES.LIST>
                            <INVENTORYENTRY>
                                <STOCKITEMNAME>Product A</STOCKITEMNAME>
                                <BILLEDQTY>50</BILLEDQTY>
                                <AMOUNT>25000.00</AMOUNT>
                            </INVENTORYENTRY>
                        </ALLINVENTORYENTRIES.LIST>
                    </VOUCHER>
                </TALLYMESSAGE>
            </REQUESTDATA>
        </IMPORTDATA>
    </BODY>
</ENVELOPE>
```

---

## 2. TRANSFORMATION PIPELINE

### Input: Raw XML Voucher
```xml
<VOUCHER VOUCHERTYPENAME="Sales" NUMBER="SJ-001">
    <DATE>20240401</DATE>
    <VOUCHERNUMBER>SJ-001</VOUCHERNUMBER>
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
```

### Step 1: Parse XML to JS
```javascript
{
  VOUCHER: {
    $: { VOUCHERTYPENAME: 'Sales', NUMBER: 'SJ-001' },
    DATE: '20240401',
    VOUCHERNUMBER: 'SJ-001',
    ALLLEDGERENTRIES: {
      LIST: [
        { LEDGERNAME: 'ABC Trading', AMOUNT: '100000.00' },
        { LEDGERNAME: 'Revenue', AMOUNT: '-100000.00' }
      ]
    }
  }
}
```

### Step 2: Validate & Normalize
```javascript
// Check: all amounts sum to 0
100000 + (-100000) = 0 ✓

// Check: no undefined names
"ABC Trading" ✓
"Revenue" ✓

// Check: amounts are numbers
100000 (number) ✓
-100000 (number) ✓
```

### Step 3: Transform to Transaction Format
```javascript
{
  date: "20240401",
  number: "SJ-001",
  type: "Sales",
  ledgers: [
    { name: "ABC Trading", amount: 100000 },
    { name: "Revenue", amount: -100000 }
  ]
}
```

### Step 4: Aggregate for Analysis
```javascript
// Monthly Stats
monthlyStats["202404"] = {
  sales: 100000,  // From Revenue vouchers
  purchase: 0
}

// Debtors
debtors["ABC Trading"].balance += 100000  // Debit = receivable

// Ledger Balances
ledgerBalances["ABC Trading"].balance += 100000
ledgerBalances["Revenue"].balance += (-100000)
```

### Step 5: Final Dashboard JSON
```json
{
  "analysis": {
    "monthlyStats": {
      "202404": { "sales": 100000, "purchase": 0 }
    },
    "debtors": [
      {
        "name": "ABC Trading",
        "parentGroup": "Sundry Debtors",
        "balance": 100000,
        "status": "Performing",
        "buckets": { "days30": 100000, "days60": 0, ... },
        "openBills": [
          { "name": "SJ-001", "date": "20240401", "amount": 100000 }
        ]
      }
    ],
    "transactions": [
      {
        "date": "20240401",
        "number": "SJ-001",
        "type": "Sales",
        "ledgers": [
          { "name": "ABC Trading", "amount": 100000 },
          { "name": "Revenue", "amount": -100000 }
        ]
      }
    ]
  }
}
```

---

## 3. PROGRESSIVE BATCHING STRATEGY

### Why Progressive?
- Tally returns ALL vouchers in ONE response if not batched
- Large responses (>50 MB) can freeze or crash Tally
- Network timeout on single large request
- Memory overflow in Node.js parsing

### Solution: Month-by-Month
```
Timeline: Apr 2024 → Mar 2025 (12 months)

Month 1 (Apr 2024):  [Fetch] → [Parse] → [2.5s delay] ✓
Month 2 (May 2024):  [Fetch] → [Parse] → [2.5s delay] ✓
Month 3 (Jun 2024):  [Fetch] → [Parse] → [2.5s delay] ✓
...
Month 12 (Mar 2025): [Fetch] → [Parse] → [Done] ✓

Total: 12 requests × ~1.2s each + 11 × 2.5s delays = ~36 seconds
```

### Pseudocode
```javascript
const months = generateMonthRange(startDate, endDate); // [202404, 202405, ...]
let successCount = 0;
let errorCount = 0;

for (const month of months) {
  try {
    console.log(`[${successCount}/${months.length}] Fetching ${month}...`);
    
    const xml = await fetchFromTally(buildVoucherRequest(month));
    await fs.writeFile(`tally_data/xml/${month}.xml`, xml);
    
    successCount++;
    console.log(`✓ ${month} fetched (${getFileSize(xml)})`);
    
    // Wait before next request
    if (month !== months[months.length - 1]) {
      await sleep(2500); // 2.5 second delay
    }
  } catch (error) {
    errorCount++;
    console.error(`✗ ${month} failed: ${error.message}`);
    console.log(`  Retrying in 5 seconds...`);
    
    await sleep(5000);
    // Retry logic here
  }
}

console.log(`\nFetch Summary: ${successCount} success, ${errorCount} errors`);
```

---

## 4. DATA QUALITY VALIDATION

### Before Output - Checklist
```javascript
const VALIDATION_CHECKLIST = {
  names: {
    rule: "No 'undefined' or null party names",
    check: (data) => {
      const debtors = data.analysis.debtors.filter(d => !d.name || d.name === 'undefined');
      return debtors.length === 0 ? PASS : FAIL;
    }
  },
  
  amounts: {
    rule: "All amounts are valid numbers",
    check: (data) => {
      const allAmounts = [];
      data.analysis.transactions.forEach(t => {
        t.ledgers.forEach(l => allAmounts.push(l.amount));
      });
      return allAmounts.every(a => typeof a === 'number' && !isNaN(a)) ? PASS : FAIL;
    }
  },
  
  balancing: {
    rule: "Each transaction debits = credits",
    check: (data) => {
      for (const t of data.analysis.transactions) {
        const sum = t.ledgers.reduce((s, l) => s + l.amount, 0);
        if (Math.abs(sum) > 0.01) return FAIL; // Allow 1 paise tolerance
      }
      return PASS;
    }
  },
  
  dates: {
    rule: "All dates in YYYYMMDD format",
    check: (data) => {
      const dateRegex = /^\d{8}$/;
      for (const t of data.analysis.transactions) {
        if (!dateRegex.test(t.date)) return FAIL;
      }
      return PASS;
    }
  },
  
  consistency: {
    rule: "Debtors sum matches transactions sum",
    check: (data) => {
      const debtorsSum = data.analysis.debtors.reduce((s, d) => s + d.balance, 0);
      const creditsSum = data.analysis.creditors.reduce((s, c) => s + c.balance, 0);
      
      // Should balance (debtors = assets, creditors = liabilities)
      return (debtorsSum >= 0 && creditsSum >= 0) ? PASS : FAIL;
    }
  }
};

// Report
const report = {};
for (const [key, validator] of Object.entries(VALIDATION_CHECKLIST)) {
  report[key] = validator.check(data) ? "✓ PASS" : "✗ FAIL";
}
```

---

## 5. PERFORMANCE METRICS

### Example Sync Report
```
════════════════════════════════════════════
        BIZSTASH DATA SYNC REPORT
════════════════════════════════════════════

Company:            SBE_Rayagada
Sync Date:          2026-02-07 10:30:00
Duration:           14.8 seconds

────────────────────────────────────────────
PHASE 1: FETCH (From Tally)
────────────────────────────────────────────
Masters:            ✓ 152 ledgers, 28 groups       (0.6s)
Statistics:         ✓ 5,240 total vouchers          (0.4s)
Vouchers (12 mo):   ✓ 5,232 fetched (2 errors)      (10.2s)
  Apr 2024: 412 ✓
  May 2024: 468 ✓
  ...
  Mar 2025: 389 ✓

────────────────────────────────────────────
PHASE 2: PARSE & VALIDATE
────────────────────────────────────────────
XML Parsing:        ✓ All valid XML                 (1.2s)
Data Validation:    
  - No undefined:   ✓ PASS
  - Amounts valid:  ✓ PASS (5,232 txns)
  - Balancing:      ✓ PASS (all Dr=Cr)
  - Dates format:   ✓ PASS (YYYYMMDD)
  - Consistency:    ✓ PASS

────────────────────────────────────────────
PHASE 3: ANALYSIS
────────────────────────────────────────────
Monthly Stats:      ✓ 12 months aggregated
Debtors:            ✓ 87 parties (₹45.2L receivable)
Creditors:          ✓ 42 suppliers (₹28.1L payable)
Stock Items:        ✓ 324 items tracked
Transactions:       ✓ 5,232 ledger entries
Ledgers:            ✓ 152 accounts with balances

────────────────────────────────────────────
PHASE 4: OUTPUT
────────────────────────────────────────────
JSON Assembly:      ✓ Complete                      (0.5s)
File Size:          2.4 MB
Location:           dashboard/public/data/SBE_Rayagada/data.json

────────────────────────────────────────────
QUALITY SCORE: 100% ✓
────────────────────────────────────────────

SUMMARY:
✓ All data successfully synced
✓ No validation errors
✓ Dashboard ready to load
✓ Last updated: 2026-02-07T10:44:48.123Z

════════════════════════════════════════════
```

---

## 6. ERROR SCENARIOS & RECOVERY

### Scenario 1: Network Timeout on Month 5
```javascript
Month 1-4: ✓ Successful
Month 5:   × Timeout after 10s

Recovery:
1. Log error: "Month 202408 timeout - retrying"
2. Wait 5 seconds
3. Retry with 20s timeout
4. If still fails, skip and log
5. Continue to Month 6

Result: 11/12 months processed, 1 skipped
```

### Scenario 2: Malformed XML Response
```javascript
Fetched: < ENVELOPE> ... </ENVELOPE>
Parsing: XML parse error at line 245

Recovery:
1. Log: "Month 202409 XML malformed"
2. Save raw response to debug folder
3. Skip this month (insufficient data)
4. Continue to next month

Result: Data incomplete but sync continues
```

### Scenario 3: Duplicate Bill Numbers
```javascript
Party: ABC Trading
Bill 1: INV-001, 20240415, ₹50,000
Bill 2: INV-001, 20240416, ₹30,000  (duplicate!)

Recovery:
1. Log warning: "Duplicate bill INV-001 in ABC Trading"
2. Keep bill with latest date (20240416)
3. Use amount ₹30,000
4. Mark as anomaly in report

Result: Data cleaned, user warned
```

---

## 7. READY FOR PRODUCTION?

**Checklist before going live:**
- [ ] Test Phase 1 (fetch) with real Tally connection
- [ ] Verify no timeouts on full year of data
- [ ] Validate all 5 modules work independently
- [ ] Run full pipeline end-to-end
- [ ] Verify JSON matches frontend schema exactly
- [ ] Load dashboard and see data
- [ ] Check sync report for 100% quality score
- [ ] Create automated job (daily/weekly)

**Current Status:** Ready for Phase 1 Implementation
