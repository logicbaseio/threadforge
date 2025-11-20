const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for all domains
app.use(cors());
app.use(express.json());

// 1. Health Check Route
// Open your backend URL in a browser to see this message and wake up the server!
app.get('/', (req, res) => {
  res.send('ThreadForge Backend is Active and Running!');
});

app.post('/api/scrape', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  console.log(`Received scrape request for: ${url}`);

  let browser;
  try {
    // Launch browser with memory-saving flags for Free Tier hosting
    browser = await puppeteer.launch({
      headless: 'new',
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH, // Uses the Docker image's Chrome
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage', // Crucial for Docker/Render memory limits
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process', 
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();
    
    // Block images/fonts/css to save bandwidth and speed up scraping
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (['image', 'stylesheet', 'font'].includes(req.resourceType())) {
        req.abort();
      } else {
        req.continue();
      }
    });

    // Set a realistic User-Agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');

    // Timeout set to 30s to fail faster if stuck
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Extract text content
    const rawText = await page.evaluate(() => document.body.innerText);

    console.log("Scrape successful");
    res.json({ text: rawText, images: [] }); // Sending empty images array as we blocked loading them for speed

  } catch (error) {
    console.error('Scraping failed:', error);
    res.status(500).json({ error: 'Failed to scrape URL', details: error.message });
  } finally {
    if (browser) await browser.close();
  }
});

app.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
});
