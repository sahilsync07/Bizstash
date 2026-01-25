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
        const vouchers = await fs.readJson(path.join(JSON_DIR, 'vouchers.json'));

        const totalVouchers = vouchers.length;
        const sales = vouchers.filter(v => v.type === 'Sales' || v.type === 'Tax Invoice');
        const purchases = vouchers.filter(v => v.type === 'Purchase');
        const receipts = vouchers.filter(v => v.type === 'Receipt');
        const payments = vouchers.filter(v => v.type === 'Payment');

        // Simple aggregation logic
        const calculateTotal = (arr) => arr.reduce((sum, v) => sum + (v.amount || 0), 0);

        // Note: Amount logic in vouchers needs to be verified based on parser output
        // For now, we return counts
        res.json({
            counts: {
                total: totalVouchers,
                sales: sales.length,
                purchases: purchases.length,
                receipts: receipts.length,
                payments: payments.length
            },
            recent: vouchers.slice(0, 5)
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.listen(PORT, () => {
    console.log(`Dashboard Server running at http://localhost:${PORT}`);
});
