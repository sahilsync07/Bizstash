const TallyConnection = require('./sync/TallyConnection');
const TdlBuilder = require('./sync/TdlBuilder');

async function test() {
    console.log("Checking Tally connection...");
    try {
        const infoXml = await TallyConnection.send(TdlBuilder.getCompanyInfo());
        console.log("Tally Response Received.");

        const nameMatch = infoXml.match(/<CURRENTCOMPANY[^>]*>([^<]+)<\/CURRENTCOMPANY>/i);
        if (nameMatch) {
            console.log(`ACTIVE COMPANY: "${nameMatch[1]}"`);
        } else {
            console.log("Could not find CURRENTCOMPANY tag. Full response:");
            console.log(infoXml);
        }
    } catch (e) {
        console.error("FAILED to connect to Tally:", e.message);
    }
}

test();
