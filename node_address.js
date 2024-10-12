const express = require('express');
const { chromium } = require('playwright');
const app = express();
const PORT = 5001;

async function getDataFromPage(url, limit) {

    try {
        const browser = await chromium.launch({
            headless: false,
            // headless: true,
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
        const button = await page.$(buttonXPath);
        await button.click();
        await page.waitForTimeout(3000);

        const tableXPath = '//*[@id="root"]/div/main/div/div/div[2]/div/div[2]/div/div[1]/div[2]/div[2]';
        let retries = 10;

        for (let attempt = 0; attempt < retries; attempt++) {
            if (await page.$(tableXPath)) {
                console.log(`Table found on attempt ${attempt + 1}`);
                break;
            } else {
                console.log(`Table not found, retrying...`);
                await page.waitForTimeout(1000);
                await button.click();
            }
        }

        for (let attempt = 0; attempt < retries; attempt++) {
            if (await page.$('div.custom-1nvxwu0')) {
                console.log(`custom-1nvxwu0 found on attempt ${attempt + 1}`);
                break;
            } else {
                console.log(`custom-1nvxwu0 not found, retrying...`);
                await page.waitForTimeout(3000);
                await page.click(buttonXPath);
                if (button) {
                    await button.click();
                    console.log('Button clicked');
                } else {
                    console.error('Button not found');
                }
            }
        }
        const rows = await page.$$('div.custom-1nvxwu0');

        // const count = await elements.count();
        if (rows.length == 0) {
            return [];
        }

        console.log(`Rows found: ${rows.length}`);



        const data = [];
        const insertedNames = new Set();
        for (let i = 0; i < rows.length; i++) {
            const all_row_divs = await rows[i].$$('div');
            let wallet_address = '';

            if (all_row_divs && all_row_divs.length > 9) {  // Ensure div[8] exists
                const linkElement = await all_row_divs[9].$('a');  // Get the anchor tag inside div[8]
                if (linkElement) {
                    const href = await linkElement.getAttribute('href');  // Get the href attribute
                    if (href) {
                        wallet_address = href.split('/').pop()?.trim() || "";  // Extract wallet address from href
                        console.log(`Wallet address: ${wallet_address}`);
                    } else {
                        console.error('href attribute not found');
                    }
                } else {
                    console.error('Anchor tag not found in div[9]');
                }
            } else {
                console.error('div[8] not found or insufficient divs in the row');
            }
            const pnl = ((await all_row_divs[5]?.innerText())?.trim() || "") + ' ';
            
            console.log('c 1');
            if (wallet_address == "") {
                continue;
            }

            data.push({
                address: wallet_address,
                pnl: pnl
            });
            // insertedNames.add(nameValue);

            if (data.length >= limit) break;
        }


        // await browser.close();
        return data;
    } catch (error) {
        console.error(` ${error.message}`);
        return [];
    }
}


app.get('/scrap', async (req, res) => {
    const token = req.query.token;
    let limit = parseInt(req.query.limit) || 5;

    if (!token) {
        return res.status(400).json({ error: 'Token parameter is required' });
    }

    const url = `https://dexscreener.com/solana/${token}?embed=1&theme=dark&info=1`;
    console.log('url', url);
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
