const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');

const run = async () => {
    const file = 'tally_data/xml/Admin_Test_PC/vouchers/vouchers.xml';
    console.log('Reading file:', file);
    const data = fs.readFileSync(file, 'utf8');

    const parser = new xml2js.Parser({ explicitArray: false, attrkey: '$' });
    const result = await parser.parseStringPromise(data);

    let vouchers = result?.ENVELOPE?.BODY?.DATA?.COLLECTION?.VOUCHER || [];
    if (!Array.isArray(vouchers)) vouchers = [vouchers];

    const stats = {};
    const detailed = [];

    const getText = (el) => {
        if (!el) return null;
        if (typeof el === 'string') return el;
        if (typeof el === 'number') return String(el);
        if (el._) return el._;
        return null;
    };

    vouchers.forEach(v => {
        const date = getText(v.DATE) || getText(v.$?.DATE);
        if (!date || !date.startsWith('202511')) return;

        const isCancelled = (getText(v.ISCANCELLED) || getText(v.$?.ISCANCELLED) || 'No');
        if (isCancelled === 'Yes') return;

        const type = (getText(v.VOUCHERTYPENAME) || getText(v.$?.VOUCHERTYPENAME) || 'Unknown').toLowerCase();
        const amtStr = getText(v.AMOUNT) || getText(v.$?.AMOUNT) || '0';
        const amt = Math.abs(parseFloat(amtStr));

        if (!stats[type]) stats[type] = { count: 0, total: 0 };
        stats[type].count++;
        stats[type].total += amt;

        detailed.push({ date, type, amt });
    });

    console.log('--- NOVEMBER 2025 BREAKDOWN ---');
    console.log(JSON.stringify(stats, null, 2));

    const salesTotal = (stats['sales']?.total || 0) + (stats['tax invoice']?.total || 0);
    const creditTotal = (stats['credit note']?.total || 0);

    console.log('SALES:');
    console.log('  Gross Sales:', salesTotal.toFixed(2));
    console.log('  Credit Notes:', creditTotal.toFixed(2));
    console.log('  Net Revenue:', (salesTotal - creditTotal).toFixed(2));

    const purchaseTotal = (stats['purchase']?.total || 0);
    const debitTotal = (stats['debit note']?.total || 0);

    console.log('PURCHASE:');
    console.log('  Gross Purchase:', purchaseTotal.toFixed(2));
    console.log('  Debit Notes:', debitTotal.toFixed(2));
    console.log('  Net Purchase:', (purchaseTotal - debitTotal).toFixed(2));

    const receiptTotal = (stats['receipt']?.total || 0);
    console.log('RECEIPTS:', receiptTotal.toFixed(2));
};

run();
