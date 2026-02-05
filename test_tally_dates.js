const { fetchCompanyRange } = require('./fetch_tally_v2');

async function test() {
    console.log("Testing fetchCompanyRange...");
    try {
        const range = await fetchCompanyRange();
        console.log("Result:", JSON.stringify(range, null, 2));
    } catch (e) {
        console.error("Test Failed:", e);
    }
}

test();
