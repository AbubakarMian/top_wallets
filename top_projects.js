const express = require('express');
const { chromium } = require('playwright');
const app = express();
const PORT = 5003;

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
    await page.waitForSelector('a.ds-dex-table-row.ds-dex-table-row-top');

    const rows = await page.$$('a.ds-dex-table-row.ds-dex-table-row-top');
    console.log(`Rows found: ${rows.length}`);

    const data = [];
    for (let i = 0; i < rows.length; i++) {
        try {
            const token_address = (await rows[i].getAttribute('href')).split('/').pop();

            const name = await rows[i].$('span.ds-dex-table-row-base-token-name-text');
            console.log('name',(await name.innerText()).trim());
            const price = await rows[i].$('div.ds-table-data-cell.ds-dex-table-row-col-price');     
            console.log('price',(await price.innerText()).trim());
            
            const all_column_val = await rows[i].$$('div.ds-table-data-cell');     
            const txns = all_column_val[3];
            const volumn = all_column_val[4];
            const liquidity = all_column_val[10];

            if (data) {
                const nameValue = (await name.innerText()).trim();
                const priceValue = (await price.innerText()).trim();
                const txnsValue = (await txns.innerText()).trim();
                const volumnValue = (await volumn.innerText()).trim();
                const liquidityValue = (await liquidity.innerText()).trim();
                data.push({ address:token_address, name: nameValue,
                    price:priceValue,
                    txns:txnsValue,
                    volumn:volumnValue,
                    liquidity:liquidityValue,
                 });

                if (data.length >= limit) break;
            }
        } catch (error) {
            console.error(`Error in row ${i}: ${error.message}`);
        }
    }

    await browser.close();
    return data;
}

app.get('/get_projects', async (req, res) => {
    

    // const url = `https://dexscreener.com/solana/raydium?embed=1&theme=dark&info=1&rankBy=volume&order=desc`;
    
    try {
        let limit = parseInt(req.query.limit) || 5;
        const url = `https://dexscreener.com/solana?embed=1&theme=dark&info=1&rankBy=volume&order=desc`;
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
