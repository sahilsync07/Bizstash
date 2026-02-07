# Bills & Vouchers Browser

## Overview

The Bills & Vouchers Browser allows you to view, search, filter, and drill into all 11,781 bills and vouchers synced from Tally Prime.

## How to Use

### 1. **Navigate to Bills & Vouchers**
   - Click **"Bills & Vouchers"** in the left sidebar
   - This opens the Bills Browser interface

### 2. **Search Bills**
   - Use the **Search Box** to find bills by:
     - **Reference Number**: e.g., "INV-001", "PO-2024"
     - **Date**: Format as YYYYMMDD (e.g., "20240401" for April 1, 2024)

### 3. **Filter by Type**
   - **All Types**: View all 11,781 bills
   - **Tax Invoice**: 3,907 sales invoices
   - **Purchase**: 1,353 purchase orders
   - **Receipt**: 2,967 cash receipts
   - **Payment**: 2,158 cash payments
   - **Journal**: 774 journal entries
   - **Contra**: 474 internal transfers
   - **Credit Note**: 144 sales returns/adjustments
   - **Debit Note**: 4 purchase returns

### 4. **Browse Bills**
   - Bills are displayed in a paginated table (20 bills per page)
   - Shows: Type, Date, Reference Number, Line Item Count
   - Page navigation: Previous/Next buttons with page indicator

### 5. **View Bill Details**
   - Click **"View"** button on any bill to open detailed modal
   - Details include:
     - **Bill Type**: Color-coded badge
     - **Date**: Formatted as DD/MM/YYYY
     - **Reference Number**: Unique identifier
     - **Line Items**: All ledger/account entries with:
       - Account/Ledger name
       - Description (if available)
       - Amount
       - Debit/Credit columns
     - **Raw JSON Data**: Full structure for reference

### 6. **Pagination**
   - Default: 20 bills per page
   - Shows current range: "Showing 1–20 of 11,781"
   - Navigate using Previous/Next buttons
   - Page counter shows "Page 1 of 589"

## Features

✅ **Full-Text Search** - Find any bill instantly
✅ **Type Filtering** - Focus on specific voucher types
✅ **Pagination** - Browse large datasets efficiently
✅ **Detail View** - Complete bill information in modal
✅ **Responsive Design** - Works on desktop & mobile
✅ **Real-time Data** - Uses live API endpoints

## API Endpoints

### Get Bills List
```
GET /api/bills?page=0&limit=50&type=Tax Invoice&search=INV
```
- `page`: Page number (0-indexed)
- `limit`: Bills per page (default: 50)
- `type`: Filter by voucher type (optional)
- `search`: Search by reference or date (optional)

### Get Bill Detail
```
GET /api/bills/:id
```
- `:id`: Index of the bill in dataset

### Get Ledger Transactions
```
GET /api/ledger/:ledgerName
```
- `:ledgerName`: Name of the ledger/account

## Examples

### Search for April 2024 Bills
1. Search Box: `202404`
2. Shows all bills from April 2024

### View All Sales (Tax Invoices)
1. Filter: Select "Tax Invoice"
2. Shows 3,907 sales invoices
3. Browse through 195 pages

### Find Receipt for Specific Customer
1. If you know the receipt number, search for it
2. Click View to see full details
3. See all ledgers and amounts involved

## Data Volume

- **Total Bills**: 11,781
- **Date Range**: April 2024 - November 2025 (601 dates)
- **Ledgers Referenced**: 1,071
- **File Size**: 1.3 MB JSON

## Tips

💡 **Performance**: Bills load quickly with pagination (20 at a time)
💡 **Search**: Use YYYYMMDD format for precise date searches
💡 **Line Items**: Each bill shows all associated ledger entries
💡 **Export**: Use browser's inspect element to export JSON for custom processing
