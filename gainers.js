const express = require('express');
const { chromium } = require('playwright');
const app = express();
const PORT = 5005;

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

    const tableXPath = '//*[@id="root"]/div/main/div[2]/div[4]';
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
    
    await page.waitForSelector('a.ds-dex-table-row.ds-dex-table-row-top');
    await page.waitForTimeout(3000);

    await page.evaluate(() => {
        return new Promise((resolve) => {
            const targetNode = document.querySelector('#root > div > main > div.ds-table-container'); // Change this to the appropriate table container

            if (!targetNode) {
                resolve(false); // Resolve if the target node doesn't exist
            }

            const observer = new MutationObserver((mutationsList) => {
                for (let mutation of mutationsList) {
                    if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                        // Resolve when new nodes are added to the table
                        observer.disconnect(); // Stop observing after detecting the change
                        resolve(true);
                        break;
                    }
                }
            });

            // Observer configuration
            const config = { childList: true, subtree: true };

            // Start observing the table for changes
            observer.observe(targetNode, config);
        });
    });


    // test

    const rows = await page.$$('a.ds-dex-table-row.ds-dex-table-row-top');
    console.log(`Rows found: ${rows.length}`);

    const data = [];
    const insertedNames = new Set();
    for (let i = 0; i < rows.length; i++) {
        try {
            const wallet_address = (await rows[i].getAttribute('href')).split('/').pop();
            
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
            const priceValue = (await price.innerText()).trim();
            const txnsValue = (await txns.innerText()).trim();
            const volumnValue = (await volumn.innerText()).trim();
            const liquidityValue = (await liquidity.innerText()).trim();
            const marketcapValue = (await marketcap.innerText()).trim();
            data.push({
                wallet_address: wallet_address, name: nameValue,
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
            queryParams.push(`maxMarketCap=1000=${max_market_cap}`);
        }

        const url = `https://dexscreener.com/gainers/${time}?${queryParams.join('&')}`;
        console.log('urlaaa',url);
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
