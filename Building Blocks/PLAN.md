# Tally Integration - Remaining Building Blocks Plan

This plan defines the remaining "Building Blocks" required to satisfy the **Minimum Entities to Verify** strategy. Each block will follow the strict `a-b-c-d` file structure (Runner, XML Output, Processor, JSON Output).

## Existing Blocks (Completed)
- **Block 1**: Company Stats (Name, Date Range, Total Voucher Qty)
- **Block 2**: All Vouchers (List of verification)

---

## Planned Blocks

### 🧱 Block 3: Masters Integrity
**Goal**: Verify the structural integrity of the company data by counting key entities.
- **Data to Fetch**:
    - Total Groups Count
    - Total Ledgers Count
    - Total Stock Items Count
    - Total Units Count
    - Total Godowns Count
- **Verification Strategy**: Ensure these specific counts match the destination database masters.
- **Files**:
    - `3.a-mastersCounts-runner.bat`
    - `3.b-mastersCounts-xml-output.xml`
    - `3.c-mastersCounts-processor.js`
    - `3.d-mastersCounts-json-output.json`

### 💰 Block 4: Accounting Integrity
**Goal**: Guarantee money correctness using high-level financial totals.
- **Data to Fetch**:
    - Trial Balance: Total Debit Amount
    - Trial Balance: Total Credit Amount
    - Profit & Loss Net Amount
- **Verification Strategy**: `Total Dr == Total Cr` dictates accounting balance. P&L match confirms revenue/expense accuracy.
- **Files**:
    - `4.a-accountingIntegrity-runner.bat`
    - `4.b-accountingIntegrity-xml-output.xml`
    - `4.c-accountingIntegrity-processor.js`
    - `4.d-accountingIntegrity-json-output.json`

### 📦 Block 5: Inventory Integrity (Summary)
**Goal**: Verify total stock position to prevent silent business losses.
- **Data to Fetch**:
    - Total Stock Quantity (grand total)
    - Total Stock Value (grand total)
- **Verification Strategy**: Quick sanity check that the overall inventory value matches.
- **Files**:
    - `5.a-inventorySummary-runner.bat`
    - `5.b-inventorySummary-xml-output.xml`
    - `5.c-inventorySummary-processor.js`
    - `5.d-inventorySummary-json-output.json`

### 📦 Block 6: Inventory Integrity (Per Item)
**Goal**: Strong check for individual stock item accuracy.
- **Data to Fetch**:
    - List of all Stock Items with:
        - Closing Quantity
        - Closing Value
- **Verification Strategy**: Ensures no individual item is mismatched, even if totals coincidentally match.
- **Files**:
    - `6.a-inventoryPerItem-runner.bat`
    - `6.b-inventoryPerItem-xml-output.xml`
    - `6.c-inventoryPerItem-processor.js`
    - `6.d-inventoryPerItem-json-output.json`

### 🧾 Block 7: Voucher Type Statistics
**Goal**: Detect missing chunks or partial exports by analyzing counts per type.
- **Data to Fetch**:
    - Voucher Count group by `VoucherTypeName` (e.g., Sales: 100, Payment: 50)
- **Verification Strategy**: Compare these specific counts with the "All Vouchers" list from Block 2 and the destination DB.
- **Files**:
    - `7.a-voucherTypeStats-runner.bat`
    - `7.b-voucherTypeStats-xml-output.xml`
    - `7.c-voucherTypeStats-processor.js`
    - `7.d-voucherTypeStats-json-output.json`
