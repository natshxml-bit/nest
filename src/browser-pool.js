import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';

class BrowserPool {
  constructor() { this.browser = null; this.warming = false; }

  async init() {
    if (this.browser) return;
    if (this.warming) while (this.warming) await new Promise(r => setTimeout(r, 100));

    this.warming = true;
    try {
      const isVercel = process.env.VERCEL || process.env.AWS_REGION;
      const executablePath = isVercel ? await chromium.executablePath() : '/usr/bin/chromium-browser';
      const args = isVercel ? chromium.args : ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'];
      this.browser = await puppeteer.launch({ executablePath, args, headless: isVercel ? chromium.headless : 'new', ignoreHTTPSErrors: true });
    } finally { this.warming = false; }
  }

  async getPage() {
    await this.init();
    const page = await this.browser.newPage();
    await page.setUserAgent(USER_AGENT);
    await page.setViewport({ width: 1366, height: 768 });
    return page;
  }

  async releasePage(page) { if (page) try { await page.close(); } catch {} }

  async close() { if (this.browser) try { await this.browser.close(); } catch {} finally { this.browser = null; } }
}

export default new BrowserPool();