const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => res.send('ThreadForge Backend is Active!'));

app.post('/api/scrape', async (req, res) => {
  if (!req.body.url) return res.status(400).json({ error: 'Missing URL' });

  console.log(`Scraping: ${req.body.url}`);

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--single-process',
        '--no-zygote'
      ]
    });

    const page = await browser.newPage();

    // 1. Set User-Agent (Helps with Facebook/Twitter)
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');

    // 2. Allow CSS/Scripts (Required for modern social apps)
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      if (['image', 'media', 'font', 'other'].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    // 3. Navigate
    await page.goto(req.body.url, { waitUntil: 'networkidle2', timeout: 45000 });
    
    // 4. AUTO-SCROLL (NEW): Essential for Facebook/Twitter Threads
    // This scrolls down to trigger the loading of replies/comments
    await page.evaluate(async () => {
        await new Promise((resolve) => {
            let totalHeight = 0;
            const distance = 100;
            const timer = setInterval(() => {
                const scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;

                // Scroll for about 2000px (enough for a good thread) or until bottom
                if (totalHeight >= 2000 || totalHeight >= scrollHeight) {
                    clearInterval(timer);
                    resolve();
                }
            }, 100); // Scroll every 100ms
        });
    });

    // 5. Final wait for any lazy-loaded content to render
    await new Promise(r => setTimeout(r, 2000));

    const text = await page.evaluate(() => document.body.innerText);
    
    if (!text || text.length < 50) {
        throw new Error("Page loaded but contained insufficient text. Possible bot block.");
    }

    res.json({ text, images: [] });

  } catch (e) {
    console.error("Scrape Error:", e.message);
    res.status(500).json({ error: 'Scrape failed', details: e.message });
  } finally {
    if (browser) await browser.close();
  }
});

app.listen(PORT, () => console.log(`Running on ${PORT}`));
