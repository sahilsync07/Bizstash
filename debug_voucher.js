const fs = require('fs-extra');
const path = require('path');
const xml2js = require('xml2js');

async function debug() {
    try {
        const vouchersFile = 'C:\\Projects\\Bizstash\\tally_data\\xml\\SBEM_Malkangiri\\vouchers.xml';

        const xml = await fs.readFile(vouchersFile, 'utf8');
        const parser = new xml2js.Parser({ explicitArray: false });
        const result = await parser.parseStringPromise(xml);

        // Structure depends on export. Collection or Envelope?
        // DataFetcher uses Collection.
        // Usually <ENVELOPE><BODY><IMPORTDATA><REQUESTDATA><TALLYMESSAGE><VOUCHER>...

        let vouchers = result?.ENVELOPE?.BODY?.IMPORTDATA?.REQUESTDATA?.TALLYMESSAGE;
        if (!vouchers) {
            // Maybe Collection format?
            // <ENVELOPE><BODY><DATA><COLLECTION><VOUCHER>...
            vouchers = result?.ENVELOPE?.BODY?.DATA?.COLLECTION?.VOUCHER;
        }

        if (!vouchers) {
            console.log('No vouchers found in XML structure');
            console.log(JSON.stringify(result, null, 2).substring(0, 500));
            return;
        }

        const list = Array.isArray(vouchers) ? vouchers : [vouchers];
        // Find one with 'ALLLEDGERENTRIES.LIST'
        const sample = list.find(v => (v['ALLLEDGERENTRIES.LIST'] || v['LEDGERENTRIES.LIST']));

        if (sample) {
            const entries = sample['ALLLEDGERENTRIES.LIST'] || sample['LEDGERENTRIES.LIST'];
            console.log('Sample Voucher Type:', sample.VOUCHERTYPENAME);
            console.log('Ledger Entries:', JSON.stringify(entries, null, 2));
        } else {
            console.log('No voucher with ledger entries found in list of', list.length);
            // Maybe structured differently
            if (list.length > 0) console.log('First voucher:', JSON.stringify(list[0], null, 2));
        }

    } catch (e) {
        console.error(e);
    }
}
debug();
