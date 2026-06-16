import Redis from 'ioredis';
import axios from 'axios';

// ─── 🔥 SETUP GAMBAR DEFAULT (API BOHONG MODE) ───
export const DEFAULT_IMG = "https://via.placeholder.com/300x450/1a1a1a/ffffff?text=No+Cover"; 

export function bersihinUrlGambar(imgUrl) {
    if (!imgUrl) return DEFAULT_IMG;
    
    let url = String(imgUrl).trim();
    
    // Hapus query parameter TERLEBIH DAHULU
    if (url.includes('?')) {
        url = url.split('?')[0];
    }
    
    const lowerUrl = url.toLowerCase();
    
    // 🔥 BLACKLIST: Pattern yang jelas-jelas bukan cover manga
    const blacklist = [
        'noimg165px.png',
        'no-image-available',
        'data:image',
        'base64',
        'placeholder-default',
        '/banner/',
        'blank.gif',
        'transparent.png',
        'svg+xml'  // SVG placeholder
    ];
    
    // 1. Cek blacklist
    if (blacklist.some(keyword => lowerUrl.includes(keyword))) {
        return DEFAULT_IMG; 
    }
    
    // 2. Cek apakah URL valid (punya ekstensi gambar ATAU dari CDN valid)
    const hasImageExt = /\.(jpg|jpeg|png|webp|avif|gif)$/i.test(url);
    const validCDN = url.includes('wp.com') || 
                    url.includes('gmbr.pro') || 
                    url.includes('manhwaindo.my') ||
                    url.includes('wordpress.com') ||
                    url.includes('shngm.id') ||
                    url.includes('ikiru.wtf') ||
                    url.includes('kiryuu.to') ||
                    url.includes('envira-cdn.com');
    
    if (!hasImageExt && !validCDN) {
        return DEFAULT_IMG;
    }
    
    // 3. 🔥 FORCE HTTPS
    if (url.startsWith('http://')) {
        url = url.replace('http://', 'https://');
    }
    
    return url;
}


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

export const axiosNinja = axios.create({
  headers: NINJA_HEADERS,
  timeout: 15000 
});

// ─── SETUP REDIS & CACHE LO ───
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