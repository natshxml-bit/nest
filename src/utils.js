import Redis from 'ioredis';

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
