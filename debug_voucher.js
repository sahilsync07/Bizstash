const fs = require('fs-extra');
const path = require('path');
const xml2js = require('xml2js');

async function debug() {
    const xmlFile = path.resolve('tally_data/xml/SBEM_Malkangiri/vouchers/vouchers.xml');
    const xml = await fs.readFile(xmlFile, 'utf8');

    const parser = new xml2js.Parser({ explicitArray: false });
    const result = await parser.parseStringPromise(xml);

    let vouchers = result.ENVELOPE.BODY.DATA.COLLECTION.VOUCHER;
    if (!Array.isArray(vouchers)) vouchers = [vouchers];

    console.log('Total Vouchers found:', vouchers.length);
    await fs.writeJson('debug_voucher.json', vouchers[0], { spaces: 2 });
    console.log('First voucher dumped to debug_voucher.json');
}

debug().catch(console.error);
