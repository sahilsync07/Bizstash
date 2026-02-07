const express = require('express');
const cors = require('cors');
const fs = require('fs-extra');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.static('public')); // Serve dashboard HTML

const JSON_DIR = path.join(__dirname, 'tally_data', 'json');

app.get('/api/masters', async (req, res) => {
    try {
        const data = await fs.readJson(path.join(JSON_DIR, 'masters.json'));
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/vouchers', async (req, res) => {
    try {
        const data = await fs.readJson(path.join(JSON_DIR, 'vouchers.json'));
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/dashboard/stats', async (req, res) => {
    try {
        const vouchersData = await fs.readJson(path.join(JSON_DIR, 'vouchers.json'));
        const vouchers = vouchersData.data ? Object.values(vouchersData.data) : [];

        const sales = vouchers.filter(v => v.type === 'Tax Invoice');
        const purchases = vouchers.filter(v => v.type === 'Purchase');
        const receipts = vouchers.filter(v => v.type === 'Receipt');
        const payments = vouchers.filter(v => v.type === 'Payment');

        res.json({
            counts: {
                total: vouchers.length,
                sales: sales.length,
                purchases: purchases.length,
                receipts: receipts.length,
                payments: payments.length
            },
            recent: vouchers.slice(0, 10)
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Bills/Vouchers API
app.get('/api/bills', async (req, res) => {
    try {
        const { type, page = 0, limit = 50, search = '' } = req.query;
        const vouchersData = await fs.readJson(path.join(JSON_DIR, 'vouchers.json'));
        let vouchers = vouchersData.data ? Object.values(vouchersData.data) : [];

        // Filter by type if specified
        if (type && type !== 'all') {
            vouchers = vouchers.filter(v => v.type === type);
        }

        // Search by reference number or date
        if (search) {
            vouchers = vouchers.filter(v => 
                (v.referenceNumber && v.referenceNumber.includes(search)) ||
                (v.date && v.date.includes(search))
            );
        }

        // Pagination
        const startIdx = parseInt(page) * parseInt(limit);
        const endIdx = startIdx + parseInt(limit);
        const paginatedVouchers = vouchers.slice(startIdx, endIdx);

        res.json({
            total: vouchers.length,
            page: parseInt(page),
            limit: parseInt(limit),
            data: paginatedVouchers
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Get bill detail
app.get('/api/bills/:id', async (req, res) => {
    try {
        const vouchersData = await fs.readJson(path.join(JSON_DIR, 'vouchers.json'));
        const vouchers = vouchersData.data ? vouchersData.data : {};
        const voucher = vouchers[req.params.id];

        if (!voucher) {
            return res.status(404).json({ error: 'Bill not found' });
        }

        res.json(voucher);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Get ledger transactions
app.get('/api/ledger/:ledgerName', async (req, res) => {
    try {
        const vouchersData = await fs.readJson(path.join(JSON_DIR, 'vouchers.json'));
        const vouchers = vouchersData.data ? Object.values(vouchersData.data) : [];
        
        const ledgerName = decodeURIComponent(req.params.ledgerName);
        const transactions = vouchers.filter(v => {
            // Match voucher if ledgerName appears in details
            if (v.details && Array.isArray(v.details)) {
                return v.details.some(d => d.ledger === ledgerName || d.account === ledgerName);
            }
            return false;
        });

        res.json({
            ledgerName,
            transactionCount: transactions.length,
            transactions: transactions.slice(0, 100) // Return first 100 for performance
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.listen(PORT, () => {
    console.log(`Dashboard Server running at http://localhost:${PORT}`);
});
