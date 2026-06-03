import Redis from 'ioredis';
import axios from 'axios'; // 🔥 Import axios di sini

// ─── SETUP AXIOS NINJA (ANTI 403) ───
export const NINJA_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
  'Referer': 'https://www.google.com/',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'cross-site',
  'Sec-Fetch-User': '?1',
  'Cache-Control': 'max-age=0'
};

// Instance axios siap pakai buat file-file scraper lo
export const axiosNinja = axios.create({
  headers: NINJA_HEADERS,
  timeout: 15000 // Toleransi loading 15 detik biar aman
});


// ─── SETUP REDIS & CACHE LO (JANGAN DIUBAH) ───
let redis = null;
if (process.env.REDIS_URL) {
  redis = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: true
  });
}

export async function cachedScrape(key, ttl, scraperFn, force = false) {
  if (!redis) {
    const data = await scraperFn();
    return { data, cached: false };
  }
  if (!force) {
    try {
      const cached = await redis.get(key);
      if (cached) return { data: JSON.parse(cached), cached: true };
    } catch (err) {
      console.error('Redis get error:', err.message);
    }
  }
  const data = await scraperFn();
  try {
    await redis.setex(key, ttl, JSON.stringify(data));
  } catch (err) {
    console.error('Redis set error:', err.message);
  }
  return { data, cached: false };
}

export function cacheKey(...parts) {
  return parts.join(':');
}
