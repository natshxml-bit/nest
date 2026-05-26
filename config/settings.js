const fs = require('fs');
const { execSync } = require('child_process');

function detectChromePath() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }

  const possiblePaths = [
    '/data/data/com.termux/files/usr/bin/chromium',
    '/data/data/com.termux/files/usr/bin/chromium-browser',
    '/data/data/com.termux/files/usr/bin/google-chrome-stable',
    '/data/data/com.termux/files/usr/bin/chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/snap/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ];

  for (const path of possiblePaths) {
    if (fs.existsSync(path)) {
      console.log(`[CONFIG] Found Chrome at: ${path}`);
      return path;
    }
  }

  try {
    const whichChrome = execSync('which chromium-browser || which chromium || which google-chrome-stable || which chrome', { encoding: 'utf8' }).trim();
    if (whichChrome) {
      console.log(`[CONFIG] Found Chrome via which: ${whichChrome}`);
      return whichChrome;
    }
  } catch (e) {}

  console.warn('[CONFIG] WARNING: Chrome not found. Set CHROME_PATH env var.');
  return process.env.CHROME_PATH || '/usr/bin/chromium-browser';
}

module.exports = {
  BASE_URL: 'https://www.manhwaindo.my',
  CHROME_PATH: detectChromePath(),
  USER_AGENT: 'Mozilla/5.0 (Linux; Android 14; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  
  PUPPETEER_OPTIONS: {
    executablePath: detectChromePath(),
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--window-size=1920,1080',
      '--disable-blink-features=AutomationControlled',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-extensions',
      '--disable-default-apps',
      '--disable-background-networking',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-infobars',
      '--hide-scrollbars',
      '--mute-audio'
    ],
    ignoreDefaultArgs: ['--enable-automation'],
    defaultViewport: { width: 1920, height: 1080 }
  }
};
