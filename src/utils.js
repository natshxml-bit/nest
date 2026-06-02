// Cache memory fallback
const memoryCache = new Map();

export async function cachedScrape(key, ttl, scrapeFn, forceRefresh = false) {
  if (!forceRefresh && memoryCache.has(key)) {
    const cached = memoryCache.get(key);
    if (cached.expire > Date.now()) {
      console.log(`[CACHE] HIT -> ${key}`);
      return { data: cached.data, cached: true };
    }
  }

  console.log(`[CACHE] MISS -> ${key}`);
  const data = await scrapeFn();
  memoryCache.set(key, { data, expire: Date.now() + ttl * 1000 });
  return { data, cached: false };
}

export function cacheKey(prefix, params = '') {
  return `manhwa:${prefix}:${params}`;
}

// Utils dari file asli
export async function waitForSelector(page, selector, timeout = 10000) {
  try { await page.waitForSelector(selector, { timeout }); return true; } 
  catch { return false; }
}

export async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise(resolve => {
      let totalHeight = 0;
      const distance = 300;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= scrollHeight) { clearInterval(timer); resolve(); }
      }, 100);
    });
  });
}

export async function retry(fn, retries = 2, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    try { return await fn(); } 
    catch (err) { if (i === retries - 1) throw err; await new Promise(r => setTimeout(r, delay)); }
  }
}