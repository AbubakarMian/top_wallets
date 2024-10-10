const express = require('express');
const { chromium } = require('playwright');
const app = express();
const PORT = 5005;
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());



async function getDataFromPage(url, limit) {
    const browser = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--window-size=1280,720',
            '--disable-extensions',
            '--proxy-bypass-list=*',
            '--start-maximized',
            '--no-first-run',
            '--no-zygote',
            '--disable-blink-features',
            '--disable-blink-features=AutomationControlled'
        ],
        ignoreDefaultArgs: ['--enable-automation'] // This hides the automation flag
    });

    const page = await browser.newPage();

    // Override navigator.webdriver to avoid detection
    await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
            get: () => false
        });
    });

    // Additional navigator properties to spoof headless detection
    await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'platform', {
            get: () => 'Win32'
        });
        Object.defineProperty(navigator, 'userAgent', {
            get: () => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        });
    });

    await page.setExtraHTTPHeaders({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    });

    // Increase the navigation timeout to 60 seconds
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    
    // Wait for a specific selector that indicates the page is ready
    await page.waitForSelector('a.ds-dex-table-row.ds-dex-table-row-top', { timeout: 60000 });

    const rows = await page.$$('a.ds-dex-table-row.ds-dex-table-row-top');
    console.log(`Rows found: ${rows.length}`);

    const data = [];
    const insertedNames = new Set();
    
    for (let i = 0; i < rows.length; i++) {
        try {
            // Use evaluate to get the href attribute
            const wallet_address = await page.evaluate(row => row.getAttribute('href'), rows[i]);
            const wallet_address_value = wallet_address.split('/').pop();

            const all_name = await rows[i].$('div.ds-table-data-cell.ds-dex-table-row-col-token');

            const baseTokenSymbol = await all_name.$eval('span.ds-dex-table-row-base-token-symbol', el => el.innerText.trim());
            const tokenDivider = await all_name.$eval('span.ds-dex-table-row-token-divider', el => el.innerText.trim());
            const quoteTokenSymbol = await all_name.$eval('span.ds-dex-table-row-quote-token-symbol', el => el.innerText.trim());
            const baseTokenNameText = await all_name.$eval('div.ds-dex-table-row-base-token-name span.ds-dex-table-row-base-token-name-text', el => el.innerText.trim());

            const name = `${baseTokenSymbol} ${tokenDivider} ${quoteTokenSymbol} ${baseTokenNameText}`;
            console.log('name:', baseTokenSymbol, tokenDivider, quoteTokenSymbol, baseTokenNameText);

            if (insertedNames.has(name)) {
                continue;
            }
            const price = await rows[i].$('div.ds-table-data-cell.ds-dex-table-row-col-price');

            const all_column_val = await rows[i].$$('div.ds-table-data-cell');
            const txns = all_column_val[3];
            const volumn = all_column_val[4];
            const liquidity = all_column_val[10];
            const marketcap = all_column_val[11];

            const nameValue = name;
            const priceValue = await price.evaluate(el => el.innerText.trim());
            const txnsValue = await txns.evaluate(el => el.innerText.trim());
            const volumnValue = await volumn.evaluate(el => el.innerText.trim());
            const liquidityValue = await liquidity.evaluate(el => el.innerText.trim());
            const marketcapValue = await marketcap.evaluate(el => el.innerText.trim());

            data.push({
                wallet_address: wallet_address_value,
                name: nameValue,
                price: priceValue,
                txns: txnsValue,
                volume: volumnValue,
                liquidity: liquidityValue,
                market_cap: marketcapValue,
            });
            insertedNames.add(nameValue);

            if (data.length >= limit) break;

        } catch (error) {
            console.error(`Error in row ${i}: ${error.message}`);
        }
    }

    await browser.close();
    return data;
}

app.get('/gainers', async (req, res) => {

    // min24HVol=50000 volume
    // minLiq=2000 liquidity
    // chainIds=solana
    https://dexscreener.com/gainers?min24HVol=50000
    try {
        let limit = parseInt(req.query.limit) || 5;
        let volume = req.query.volume || "";
        let liquidity = req.query.liquidity || "";
        let time = req.query.time || "";
        let min_market_cap = req.query.min_market_cap || "";
        let max_market_cap = req.query.max_market_cap || "";

        if (!['24h', '6h', '1h', '5m'].includes(time)) {
            time = '24h';
        }

        let queryParams = [`chainIds=solana`, `embed=1`, `theme=dark`, `info=1`];

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

        const url = `https://dexscreener.com/gainers/${time}?${queryParams.join('&')}`;
        console.log('urlaaa', url);
        const data = await getDataFromPage(url, limit);
        return res.json(data);

    } catch (error) {
        console.error(`Error in /gainers route: ${error.message}`);
        return res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
