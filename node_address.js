const express = require('express');
const { chromium } = require('playwright');
const app = express();
const PORT = 5001;
const puppeteer = require('puppeteer');

async function getDataFromPage(url, limit) {
    const browser = await puppeteer.launch({
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

    // Set the user-agent header
    await page.setExtraHTTPHeaders({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    });

    // Navigate to the URL
    await page.goto(url);

    // Use page.evaluate to click the button using XPath
    const buttonXPath = '//*[@id="root"]/div/main/div/div/div[2]/div/div[2]/div/div[1]/div[1]/div[1]/div/div[1]/button[2]';
    await page.evaluate((buttonXPath) => {
        const button = document.evaluate(buttonXPath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
        if (button) {
            button.click();
        }
    }, buttonXPath);

    console.log('Button clicked');

    // Define the table XPath and retry logic
    const tableXPath = "//html/body/div[1]/div/main/div/div/div[2]/div/div[2]/div/div[1]/div[2]/div[2]";
    let retries = 10;

    for (let attempt = 0; attempt < retries; attempt++) {
        const tableFound = await page.evaluate((xpath) => {
            const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
            return result !== null;
        }, tableXPath);

        if (tableFound) {
            console.log(`Table found on attempt ${attempt + 1}`);
            break;
        } else {
            console.log(`Table not found, retrying...`);
            await page.evaluate((buttonXPath) => {
                const button = document.evaluate(buttonXPath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                if (button) {
                    button.click();
                }
            }, buttonXPath);
            await new Promise(resolve => setTimeout(resolve, 1500));
        }
    }

    
    for (let attempt = 0; attempt < retries; attempt++) {
        xpath = `div.custom-1nvxwu0`;
        const tableFound = await page.evaluate(() => {
            return document.querySelector('div.custom-1nvxwu0') !== null;
        });
        

        await new Promise(resolve => setTimeout(resolve, 1500));
        if (tableFound) {
            console.log(`div.custom-1nvxwu0 found on attempt ${attempt + 1}`);
            break;
        } else {
            console.log(`div.custom-1nvxwu0 not found, retrying...`);
            await page.evaluate((buttonXPath) => {
                const button = document.evaluate(buttonXPath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                if (button) {
                    button.click();
                }
            }, buttonXPath);
            await new Promise(resolve => setTimeout(resolve, 1500));
        }
    }

    // Wait for the specific table rows to load after the table is found
    // await page.waitForSelector('div.custom-1nvxwu0', { timeout: 60000 });

    const rows = await page.$$('div.custom-1nvxwu0');
    console.log(`Rows found: ${rows.length}`);

    const data = [];

    for (let i = 0; i < rows.length; i++) {
        try {
            // Extract the desired data from each row
            const pnlDiv = await rows[i].$('div.custom-1e9y0rl');
            const addressDiv = await rows[i].$('div.custom-1dwgrrr a');

            if (pnlDiv && addressDiv) {
                const pnlValue = (await pnlDiv.evaluate(el => el.innerText)).trim();
                const address = (await addressDiv.evaluate(el => el.getAttribute('href'))).split('/').pop();

                data.push({ address, pnl: pnlValue });

                // Stop if the limit is reached
                if (data.length >= limit) break;
            }
        } catch (error) {
            console.error(`Error in row ${i}: ${error.message}`);
        }
    }

    // Close the browser and return the collected data
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
    console.log('urllll ',url);
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
