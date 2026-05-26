// src/browser-pool.js
const puppeteer = require('puppeteer-core');

// Auto-detect Chromium path (Termux / Linux / Windows / Mac)
function getChromiumPath() {
  const paths = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    '/data/data/com.termux/files/usr/bin/chromium-browser',
    '/data/data/com.termux/files/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
  ];
  return paths.find(p => p) || undefined;
}

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

class BrowserPool {
  constructor() {
    this.browser = null;
    this.warming = false;
  }

  async init() {
    if (this.browser) return;
    if (this.warming) {
      // Tunggu kalau ada proses init lain yang lagi jalan
      while (this.warming) {
        await new Promise(r => setTimeout(r, 100));
      }
      return;
    }

    this.warming = true;
    try {
      const executablePath = getChromiumPath();

      this.browser = await puppeteer.launch({
        executablePath,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-background-networking',
          '--disable-default-apps',
          '--disable-extensions',
          '--disable-sync',
          '--disable-translate',
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process'
        ],
        headless: 'new',           // headless: 'new' buat Chrome 109+
        ignoreHTTPSErrors: true,
      });

      console.log('[POOL] Browser pool warmed up');
    } catch (err) {
      console.error('[POOL] Failed to launch browser:', err.message);
      throw err;
    } finally {
      this.warming = false;
    }
  }

  async getPage() {
    await this.init();
    const page = await this.browser.newPage();
    await page.setUserAgent(USER_AGENT);
    await page.setViewport({ width: 1366, height: 768 });
    
    // Block image & CSS biar lebih cepat (optional, uncomment kalau perlu)
    // await page.setRequestInterception(true);
    // page.on('request', (req) => {
    //   if (['image', 'stylesheet', 'font'].includes(req.resourceType())) {
    //     req.abort();
    //   } else {
    //     req.continue();
    //   }
    // });

    return page;
  }

  async releasePage(page) {
    if (!page) return;
    try {
      await page.close();
    } catch (e) {
      // ignore
    }
  }

  async close() {
    if (!this.browser) return;
    try {
      await this.browser.close();
    } catch (e) {
      // ignore
    } finally {
      this.browser = null;
    }
  }
}

module.exports = new BrowserPool();
