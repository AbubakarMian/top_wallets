const express = require('express');
const { chromium } = require('playwright');
const app = express();
const PORT = 5001;

async function getDataFromPage(url, limit) {
    const browser = await chromium.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--window-size=1280,720'
        ]
    });

    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    });
    await page.goto(url);
    const buttonXPath = '//*[@id="root"]/div/main/div/div/div[2]/div/div[2]/div/div[1]/div[1]/div[1]/div/div[1]/button[2]';
    await page.waitForSelector(buttonXPath);
    await page.click(buttonXPath);
    console.log('Button clicked');

    const tableXPath = "//html/body/div[1]/div/main/div/div/div[2]/div/div[2]/div/div[1]/div[2]/div[2]";
    let retries = 10;

    for (let attempt = 0; attempt < retries; attempt++) {
        if (await page.$(tableXPath)) {
            console.log(`Table found on attempt ${attempt + 1}`);
            break;
        } else {
            console.log(`Table not found, retrying...`);
            await page.evaluate((buttonXPath) => {
                document.evaluate(buttonXPath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.click();
            }, buttonXPath);
            await page.waitForTimeout(1000);
        }
    }
    
    for (let attempt = 0; attempt < retries; attempt++) {
        if (await page.$('div.custom-1nvxwu0')) {
            console.log(`'div.custom-1nvxwu0' found on attempt ${attempt + 1}`);
            break;
        } else {
            console.log(`'div.custom-1nvxwu0' not found, retrying...`);
            await page.evaluate((buttonXPath) => {
                document.evaluate(buttonXPath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.click();
            }, buttonXPath);
            await page.waitForTimeout(1000);
        }
    }
    // await page.waitForSelector('div.custom-1nvxwu0');

    const rows = await page.$$('div.custom-1nvxwu0');
    console.log(`Rows found: ${rows.length}`);

    const data = [];
    for (let i = 0; i < rows.length; i++) {
        try {
            const pnlDiv = await rows[i].$('div.custom-1e9y0rl');
            const addressDiv = await rows[i].$('div.custom-1dwgrrr a');

            if (pnlDiv && addressDiv) {
                const pnlValue = (await pnlDiv.innerText()).trim();
                const address = (await addressDiv.getAttribute('href')).split('/').pop();
                data.push({ address, pnl: pnlValue });

                if (data.length >= limit) break;
            }
        } catch (error) {
            console.error(`Error in row ${i}: ${error.message}`);
        }
    }

    await browser.close();
    return data;
}

app.get('/scrap', async (req, res) => {
    const token = req.query.token;
    let limit = parseInt(req.query.limit) || 5;

    if (!token) {
        return res.status(400).json({ error: 'Token parameter is required' });
    }

    const url = `https://dexscreener.com/solana/${token}?embed=1&theme=dark&info=1`;
    console.log(`Received request for token: ${token} with limit: ${limit}`);

    try {
        const data = await getDataFromPage(url, limit);
        return res.json(data);
    } catch (error) {
        console.error(`Error in /scrap route: ${error.message}`);
        return res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
