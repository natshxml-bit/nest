const Redis = require('ioredis');

// === CONFIG ===
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const DEFAULT_TTL = {
  home: 300,           // 5 menit
  detail: 3600,        // 1 jam
  read: 600,           // 10 menit
  search: 300,         // 5 menit
  latest: 300,         // 5 menit
  updates: 300,      // 5 menit
  genre: 3600,        // 1 jam
  'genre-list': 3600   // 1 jam
};

let redis = null;
let redisAvailable = false;

// Coba connect Redis
try {
  redis = new Redis(REDIS_URL, {
    retryStrategy: (times) => {
      if (times > 3) {
        console.warn('[CACHE] Redis nggak nyambung, switch ke memory cache');
        redisAvailable = false;
        return null; // stop retry
      }
      return Math.min(times * 100, 3000);
    },
    maxRetriesPerRequest: 1,
    enableReadyCheck: true
  });

  redis.on('connect', () => {
    console.log('[CACHE] Redis connected');
    redisAvailable = true;
  });

  redis.on('error', (err) => {
    redisAvailable = false;
  });

} catch (e) {
  console.warn('[CACHE] Redis gagal init:', e.message);
}

// === FALLBACK: In-memory cache ===
const memoryCache = new Map();

function memSet(key, value, ttlSeconds) {
  const expireAt = Date.now() + (ttlSeconds * 1000);
  memoryCache.set(key, { value, expireAt });
}

function memGet(key) {
  const item = memoryCache.get(key);
  if (!item) return null;
  if (Date.now() > item.expireAt) {
    memoryCache.delete(key);
    return null;
  }
  return item.value;
}

// === MAIN CACHE FUNCTIONS ===
async function get(key) {
  try {
    if (redisAvailable && redis) {
      const val = await redis.get(key);
      if (val) return JSON.parse(val);
    }
  } catch (e) {
    redisAvailable = false;
  }
  return memGet(key);
}

async function set(key, value, ttlSeconds = 300) {
  try {
    if (redisAvailable && redis) {
      await redis.setex(key, ttlSeconds, JSON.stringify(value));
      return;
    }
  } catch (e) {
    redisAvailable = false;
  }
  memSet(key, value, ttlSeconds);
}

async function del(key) {
  try {
    if (redisAvailable && redis) await redis.del(key);
  } catch (e) { /* ignore */ }
  memoryCache.delete(key);
}

async function flush() {
  try {
    if (redisAvailable && redis) await redis.flushdb();
  } catch (e) { /* ignore */ }
  memoryCache.clear();
}

module.exports = {
  get,
  set,
  del,
  flush,
  DEFAULT_TTL,
  isRedisReady: () => redisAvailable
};
