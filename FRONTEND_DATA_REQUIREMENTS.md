# Frontend Data Requirements for Bizstash

## Overview
The Bizstash frontend is a React-based financial dashboard that expects data in JSON format. It does **NOT** directly connect to Tally or any backend API. All data must be provided as **static JSON files** served from the `/dashboard/public/data/` directory.

---

## File Structure

```
dashboard/public/data/
├── companies.json                    # List of all companies
├── {company-id}/
│   └── data.json                    # All financial data for that company
```

---

## 1. Companies Index: `companies.json`

**Location:** `dashboard/public/data/companies.json`

**Purpose:** List of all available companies to display in the company switcher dropdown.

**Format:**
```json
[
  {
    "id": "SE_Koraput",
    "name": "SE Koraput",
    "lastUpdated": "2026-01-26T03:46:21.907Z"
  },
  {
    "id": "SBE_Rayagada",
    "name": "SBE Rayagada",
    "lastUpdated": "2026-01-26T12:34:37.854Z"
  }
]
```

**Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique company identifier (folder name under `/data/`) |
| `name` | string | Display name shown in UI |
| `lastUpdated` | ISO 8601 datetime | When data was last synced (e.g., "2026-02-05T07:28:43.458Z") |

**Required:** At least one company entry

---

## 2. Company Data: `{company-id}/data.json`

**Location:** `dashboard/public/data/{company-id}/data.json`

**Purpose:** Complete financial dataset for a specific company (all analysis, ledgers, transactions, parties, inventory).

**Root Structure:**
```json
{
  "meta": { ... },
  "linemanConfig": [ ... ],
  "analysis": { ... }
}
```

---

### 2.1 Metadata Section: `meta`

```json
{
  "meta": {
    "companyName": "Company Name",
    "lastUpdated": "2026-02-05T07:28:43.458Z"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `companyName` | string | Display name of company |
| `lastUpdated` | ISO 8601 datetime | Timestamp of last data sync |

---

### 2.2 Lineman Configuration: `linemanConfig`

**Purpose:** Defines sales team members and their assigned sales territories (lines).

```json
{
  "linemanConfig": [
    {
      "name": "Sushant [Bobby]",
      "lines": ["TIKIRI", "KASIPUR", "DURGI", "THERUBALI", "JK", "KALYAN SINGHPUR"],
      "color": "bg-blue-500"
    },
    {
      "name": "Dulamani Sahu",
      "lines": ["BALIMELA", "CHITROKUNDA", "MALKANGIRI"],
      "color": "bg-purple-500"
    }
  ]
}
```

**Lineman Object Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Full name of salesman/lineman |
| `lines` | string[] | List of territory/group names they manage |
| `color` | string | Tailwind CSS color class (e.g., "bg-blue-500", "bg-purple-500") |

**Requirements:**
- At least one lineman entry recommended
- Colors should be valid Tailwind classes for visual consistency
- Lines must match party group names in the debtors data

---

### 2.3 Analysis Section: `analysis`

Contains all financial metrics and transactional data.

```json
{
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
```

---

#### 2.3.1 Monthly Statistics: `analysis.monthlyStats`

**Purpose:** Monthly aggregated sales and purchase data for charts.

```json
{
  "monthlyStats": {
    "202604": {
      "sales": 150000,
      "purchase": 100000
    },
    "202605": {
      "sales": 200000,
      "purchase": 120000
    }
  }
}
```

**Fields:**
- **Key:** `YYYYMM` format (year + month, 6 digits)
- **sales:** Number (INR, cumulative for month)
- **purchase:** Number (INR, cumulative for month)

**Requirements:**
- At least one month of data required for dashboard to function
- If no data, can be empty object `{}`
- Used for: Monthly charts, Sales Analytics tab

---

#### 2.3.2 Debtors: `analysis.debtors`

**Purpose:** List of all parties who owe money (customers, receivables).

```json
{
  "debtors": [
    {
      "name": "ABC Trading Company",
      "parentGroup": "KASIPUR",
      "balance": 50000,
      "status": "Performing",
      "buckets": {
        "days30": 20000,
        "days60": 10000,
        "days90": 15000,
        "daysOver90": 5000
      },
      "openBills": [
        {
          "name": "INV-001",
          "date": "20260101",
          "amount": 10000
        }
      ]
    }
  ]
}
```

**Debtor Object Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Party/customer name |
| `parentGroup` | string | Sales territory/line (must match lineman's `lines`) |
| `balance` | number | Total outstanding amount (INR) |
| `status` | string | "Performing" or "Non-Performing" |
| `buckets.days30` | number | Amount due within 30 days |
| `buckets.days60` | number | Amount due 30-60 days past |
| `buckets.days90` | number | Amount due 60-90 days past |
| `buckets.daysOver90` | number | Amount overdue >90 days |
| `openBills` | array | List of individual bills/invoices |

**Open Bills Structure:**
```json
{
  "name": "INV-001",
  "date": "20260101",
  "amount": 10000
}
```
- `name`: Invoice/bill number (string)
- `date`: Bill date (YYYYMMDD format, 8 digits)
- `amount`: Bill amount (number, INR)

**Requirements:**
- Can be empty array `[]` if no debtors
- Used for: Dashboard summary, Party Analytics, Lineman View, Overdue analysis
- If `openBills` is null, defaults to empty array

---

#### 2.3.3 Creditors: `analysis.creditors`

**Purpose:** List of parties who are owed money (suppliers, payables).

**Structure:** Identical to debtors with same fields.

```json
{
  "creditors": [
    {
      "name": "XYZ Supply Ltd",
      "parentGroup": "Sundry Creditors",
      "balance": 100000,
      "status": "Performing",
      "buckets": {
        "days30": 50000,
        "days60": 30000,
        "days90": 20000,
        "daysOver90": 0
      },
      "openBills": [
        {
          "name": "BILL-001",
          "date": "20251215",
          "amount": 50000
        }
      ]
    }
  ]
}
```

**Requirements:**
- Can be empty array if no creditors
- Used for: Dashboard summary, Overdue (Payables) tab, Creditor Analytics
- Note: Backend incorrectly created a "undefined" creditor - should be filtered out or named properly

---

#### 2.3.4 Stock/Inventory: `analysis.stocks`

**Purpose:** Item-wise inventory details and movement tracking.

```json
{
  "stocks": [
    {
      "name": "Product A",
      "inwardQty": 100,
      "outwardQty": 45,
      "closingQty": 55,
      "closingValue": 55000,
      "revenue": 22500,
      "qtySold": 30,
      "lastSaleDate": "20260205",
      "lastPurchaseDate": "20260101"
    }
  ]
}
```

**Stock Object Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Product/item name |
| `inwardQty` | number | Total quantity received |
| `outwardQty` | number | Total quantity sold/issued |
| `closingQty` | number | Current stock quantity |
| `closingValue` | number | Current stock value (INR) |
| `revenue` | number | Total revenue from this item |
| `qtySold` | number | Number of units sold |
| `lastSaleDate` | string | Last sale date (YYYYMMDD, 8 digits) |
| `lastPurchaseDate` | string | Last purchase date (YYYYMMDD, 8 digits) |

**Requirements:**
- Can be empty array if no inventory tracked
- Used for: Inventory Analytics tab, Dashboard widget
- FSN categorization (Fast/Slow/Non-Moving) is calculated by frontend based on `lastSaleDate`

---

#### 2.3.5 Transactions: `analysis.transactions`

**Purpose:** Complete journal of all ledger transactions for drill-down analysis.

```json
{
  "transactions": [
    {
      "date": "20260101",
      "number": "JN-001",
      "type": "Journal Entry",
      "ledgers": [
        {
          "name": "ABC Trading Company",
          "amount": 50000
        },
        {
          "name": "Cash",
          "amount": -50000
        }
      ]
    },
    {
      "date": "20260102",
      "number": "SJ-001",
      "type": "Sales",
      "ledgers": [
        {
          "name": "Debtors",
          "amount": 100000
        },
        {
          "name": "Revenue",
          "amount": -100000
        }
      ]
    }
  ]
}
```

**Transaction Object Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `date` | string | Transaction date (YYYYMMDD, 8 digits) |
| `number` | string | Reference/voucher number |
| `type` | string | Voucher type (e.g., "Sales", "Purchase", "Journal", "Receipt", "Payment") |
| `ledgers` | array | List of ledger entries (always 2+) |

**Ledger Entry Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Account/ledger name |
| `amount` | number | Debit (positive) or Credit (negative) amount |

**Requirements:**
- Can be empty array if no transactions
- Must maintain double-entry bookkeeping (sum of amounts = 0)
- Dates must be sorted chronologically
- Used for: Ledger View, Party drill-down, all calculations
- Critical for accuracy: amount signs matter (positive = debit, negative = credit)

---

#### 2.3.6 Ledger Names: `analysis.ledgersList`

**Purpose:** List of all ledger/account names in the system.

```json
{
  "ledgersList": [
    "ABC Trading Company",
    "Cash",
    "Bank",
    "Revenue",
    "Cost of Goods Sold"
  ]
}
```

**Requirements:**
- Array of strings (ledger names)
- Can be empty array
- Used for: Ledger View dropdown selector
- Should include all accounts that appear in transactions

---

#### 2.3.7 Ledger Opening Balances: `analysis.ledgerOpenings`

**Purpose:** Opening balance for each ledger account (as of start date).

```json
{
  "ledgerOpenings": {
    "ABC Trading Company": {
      "parent": "Sundry Debtors",
      "openingBalance": 25000,
      "rootGroup": "Assets"
    },
    "Cash": {
      "parent": "Bank Accounts",
      "openingBalance": 100000,
      "rootGroup": "Assets"
    }
  }
}
```

**Ledger Opening Object Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `parent` | string | Parent group/classification |
| `openingBalance` | number | Starting balance (debit=positive, credit=negative) |
| `rootGroup` | string | Root classification (Assets, Liabilities, Equity, etc.) |

**Requirements:**
- Key: ledger name (must match entries in `ledgersList`)
- Can be empty object `{}` if using transaction history
- Used for: Ledger running balance calculations
- If missing for a ledger, frontend assumes opening balance = 0

---

## Summary of Data Dependencies

### For Dashboard Summary Tab:
- ✅ `monthlyStats` (sales/purchase)
- ✅ `debtors` (receivables)
- ✅ `creditors` (payables)
- ✅ `stocks` (top items)

### For Sales Analytics Tab:
- ✅ `monthlyStats`

### For Party Analytics (Debtors/Creditors):
- ✅ `debtors` or `creditors`
- ✅ `linemanConfig` (for drilldown to lineman view)

### For Inventory Tab:
- ✅ `stocks`
- ✅ `lastSaleDate` in stock items

### For Lineman View:
- ✅ `linemanConfig`
- ✅ `debtors` with matching `parentGroup`

### For Overdue/Payables Tab:
- ✅ `creditors` with `openBills` data

### For Ledger View:
- ✅ `transactions` (all)
- ✅ `ledgersList`
- ✅ `ledgerOpenings`

---

## Minimum Data to Run Website

**Bare minimum to avoid error screens:**
1. `dashboard/public/data/companies.json` - at least one company
2. `dashboard/public/data/{company-id}/data.json` - with:
   - `meta` object (companyName, lastUpdated)
   - `linemanConfig` - empty array is okay
   - `analysis` object with:
     - `monthlyStats`: `{}` (empty) or data
     - `debtors`: `[]` (empty array)
     - `creditors`: `[]` (empty array)
     - `stocks`: `[]` (empty array)
     - `transactions`: `[]` (empty array)
     - `ledgersList`: `[]` (empty array)
     - `ledgerOpenings`: `{}` (empty object)

---

## Data Quality Notes

### Common Issues:
1. **"undefined" entries** - Filter out any party/ledger with "undefined" name
2. **Date format** - Must be YYYYMMDD (8 characters), no separators
3. **Amount signs** - Transaction amounts must have correct sign (debit/credit)
4. **Missing linemanConfig** - If absent, lineman view will be empty (but won't crash)
5. **Missing openBills** - Defaults to empty array; overdue tab will show no details

### Validation Checklist:
- [ ] All dates are YYYYMMDD format
- [ ] No "undefined" entries in debtors/creditors
- [ ] Transaction amounts sum to zero per entry
- [ ] Ledger names in transactions match `ledgersList`
- [ ] Party groups match lineman's configured `lines`
- [ ] `lastUpdated` timestamps are valid ISO 8601

---

## Example Complete Data File

See `dashboard/public/data/Admin_Test_PC/data.json` for a working reference (though it has "undefined" entries that should be cleaned).

---

## To Run Website:

```bash
cd dashboard
npm install
npm run dev
```

Or for production:
```bash
npm run build
# Serve dist/ folder
```

The frontend will load data from `public/data/` automatically.
