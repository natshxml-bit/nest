const puppeteer = require('puppeteer-core');
let chromium = null;
try {
  chromium = require('@sparticuz/chromium');
} catch (e) {
  // Ignore kalau di lokal gak ada
}

// Auto-detect Chromium path buat lokal (Termux / PC)
function getChromiumPath() {
  const paths = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    '/data/data/com.termux/files/usr/bin/chromium-browser',
    '/data/data/com.termux/files/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome-stable',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  ];
  return paths.find(p => p) || undefined;
}

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';

class BrowserPool {
  constructor() {
    this.browser = null;
    this.warming = false;
  }

  async init() {
    if (this.browser) return;
    if (this.warming) {
      while (this.warming) await new Promise(r => setTimeout(r, 100));
      return;
    }

    this.warming = true;
    try {
      // Cek apakah lagi jalan di Vercel atau di Lokal
      const isVercel = process.env.VERCEL || process.env.AWS_REGION;
      
      let executablePath;
      let args;

      if (isVercel && chromium) {
        // Mode Vercel
        executablePath = await chromium.executablePath();
        args = chromium.args;
      } else {
        // Mode Lokal (Termux / PC)
        executablePath = getChromiumPath();
        args = [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--single-process'
        ];
      }

      this.browser = await puppeteer.launch({
        executablePath,
        args,
        headless: isVercel ? chromium.headless : 'new',
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
    
    // Pasang Headers Nyamar di Puppeteer
    await page.setUserAgent(USER_AGENT);
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
      'sec-ch-ua': '"Google Chrome";v="123", "Not:A-Brand";v="8", "Chromium";v="123"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'referer': 'https://www.google.com/'
    });

    await page.setViewport({ width: 1366, height: 768 });
    return page;
  }

  async releasePage(page) {
    if (!page) return;
    try { await page.close(); } catch (e) {}
  }

  async close() {
    if (!this.browser) return;
    try { await this.browser.close(); } catch (e) {} finally { this.browser = null; }
  }
}

module.exports = new BrowserPool();
