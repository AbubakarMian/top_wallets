const express = require('express');
const { chromium } = require('playwright');
const app = express();
const PORT = 5003;

async function getDataFromPage(url, limit) {

    try {
        const browser = await chromium.launch({
            // headless: false,
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
        await page.waitForTimeout(3000);

        const tableXPath = '//*[@id="root"]/div/main/div/div[2]/div[4]';
        let retries = 10;

        for (let attempt = 0; attempt < retries; attempt++) {
            if (await page.$(tableXPath)) {
                console.log(`Table found on attempt ${attempt + 1}`);
                break;
            } else {
                console.log(`Table not found, retrying...`);
                await page.waitForTimeout(1000);
            }
        }
        // await page.waitForSelector('a.ds-dex-table-row.ds-dex-table-row-top');

        const rows = await page.$$('a.ds-dex-table-row.ds-dex-table-row-top');

        // const elements = page.locator('.custom-1egwgdj');
        // const count = await elements.count();
        if (rows.length == 0) {
            return [];
        }

        console.log(`Rows found: ${rows.length}`);

        const data = [];
        const insertedNames = new Set();
        for (let i = 0; i < rows.length; i++) {
            const wallet_address = (await rows[i].getAttribute('href')).split('/').pop();
            console.log('c 1');
            const all_name = await rows[i].$('div.ds-table-data-cell.ds-dex-table-row-col-token');
            const all_name_spans = await all_name.$$('span');
            const name =
                ((await all_name_spans[1]?.innerText())?.trim() || "") + ' ' +
                ((await all_name_spans[2]?.innerText())?.trim() || "") + ' ' +
                ((await all_name_spans[3]?.innerText())?.trim() || "") + ' ' +
                ((await all_name_spans[4]?.innerText())?.trim() || "") + ' ' +
                ((await all_name_spans[5]?.innerText())?.trim() || "");
            if (insertedNames.has(name)) {
                continue;
            }
            const price = await rows[i].$('div.ds-table-data-cell.ds-dex-table-row-col-price');
            console.log('c 3');

            const all_column_val = await rows[i].$$('div.ds-table-data-cell');
            console.log('c 4');

            const txns = all_column_val[3];
            console.log('c 5');

            const volumn = all_column_val[4];
            console.log('c 6');

            const liquidity = all_column_val[10];
            console.log('c 7');

            const nameValue = name;
            const priceValue = ((await price?.innerText())?.trim() || "");
            const txnsValue = ((await txns?.innerText())?.trim() || "");
            const volumnValue = ((await volumn?.innerText())?.trim() || "");
            const liquidityValue = ((await liquidity?.innerText())?.trim() || "");
            data.push({
                wallet_address: wallet_address, name: nameValue,
                price: priceValue,
                txns: txnsValue,
                volumn: volumnValue,
                liquidity: liquidityValue,
            });
            insertedNames.add(nameValue);

            if (data.length >= limit) break;


        }

        await browser.close();
        return data;
    } catch (error) {
        console.error(` ${error.message}`);
        return [];
    }
}

app.get('/get_projects', async (req, res) => {


    // const url = `https://dexscreener.com/solana/raydium?embed=1&theme=dark&info=1&rankBy=volume&order=desc`;

    try {


        let limit = parseInt(req.query.limit) || 5;
        let volume = req.query.volume || "";
        let liquidity = req.query.liquidity || "";
        let time = req.query.time || "";
        let min_market_cap = req.query.min_market_cap || "";
        let max_market_cap = req.query.max_market_cap || "";


        let queryParams = [`embed=1`, `theme=dark`, `info=1`];

        if (!['24h', '6h', '1h', '5m'].includes(time)) {
            time = '24h';
            let score = '';
            score = time == '24h' ? 'H24' : time == '6h' ? 'H6' : 'M5';
            score = 'trendingScore' + score;
            // queryParams.push(`rankBy=${score}`);
            // queryParams.push(`order=desc`);
        }


        if (volume) {
            queryParams.push(`min24HVol=${volume}`);
        }
        if (liquidity) {
            queryParams.push(`minLiq=${liquidity}`);
        }
        if (min_market_cap) {
            queryParams.push(`minMarketCap=${min_market_cap}`);
        }
        if (max_market_cap) {
            queryParams.push(`maxMarketCap=${max_market_cap}`);
        }
        const url = `https://dexscreener.com/solana/raydium/${time}?${queryParams.join('&')}`;

        console.log('my url', url);
        // const url = `https://dexscreener.com/solana/raydium?embed=1&theme=dark&info=1&rankBy=volume&order=desc`;
        const data = await getDataFromPage(url, limit);
        console.log(`Received request for : with limit: ${limit}`);

        return res.json(data);
    } catch (error) {
        console.error(`Error in /scrap route: ${error.message}`);
        return res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
