// src/server.js
const express = require('express');
const cache = require('./cache/redis-cache');
const DEFAULT_TTL = cache.DEFAULT_TTL;

// Scraper modules
const { scrapeHome } = require('./scraper/home');
const { scrapeDetail } = require('./scraper/detail');
const { scrapeRead } = require('./scraper/read');
const { scrapeSearch } = require('./scraper/search');
const { scrapeLatestPage } = require('./scraper/latest');
const { scrapeUpdates } = require('./scraper/update');
const { scrapeGenres, scrapeByGenre } = require('./scraper/genre');
const { scrapeFilter } = require('./scraper/filter'); // <-- TAMBAHAN IMPORT FILTER

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Helper: cache key
const cacheKey = (prefix, params = '') => `manhwa:${prefix}:${params}`;

// Helper: cached scrape
const cachedScrape = async (key, ttl, scrapeFn, forceRefresh = false) => {
  if (!forceRefresh) {
    const cached = await cache.get(key);
    if (cached) {
      console.log(`[CACHE] HIT -> ${key}`);
      return { data: cached, cached: true };
    }
  }
  
  console.log(`[CACHE] MISS -> ${key}`);
  const data = await scrapeFn();
  await cache.set(key, data, ttl);
  
  return { data, cached: false };
};

// === ROUTES ===

// HOME
app.get('/api/home', async (req, res) => {
  const start = Date.now();
  const force = req.query.refresh === '1';
  try {
    const { data, cached } = await cachedScrape(cacheKey('home'), DEFAULT_TTL.home, scrapeHome, force);
    res.json({
      success: true,
      time_ms: Date.now() - start,
      cached,
      count: {
        popular: data.popular_today?.length || 0,
        latest: data.latest_update?.length || 0,
        project: data.project_update?.length || 0
      },
      data
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// UPDATES
app.get('/api/updates', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const force = req.query.refresh === '1';
  const start = Date.now();
  try {
    const { data, cached } = await cachedScrape(cacheKey('updates', `page${page}`), DEFAULT_TTL.updates, () => scrapeUpdates(page), force);
    res.json({
      success: true,
      time_ms: Date.now() - start,
      cached,
      page: data.pagination?.current || page,
      has_next: data.pagination?.has_next || false,
      count: data.results?.length || 0,
      data: data.results || []
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GENRES
app.get('/api/genres', async (req, res) => {
  const start = Date.now();
  const force = req.query.refresh === '1';
  try {
    const { data, cached } = await cachedScrape(cacheKey('genres'), DEFAULT_TTL['genre-list'], scrapeGenres, force);
    res.json({
      success: true,
      time_ms: Date.now() - start,
      cached,
      count: data?.length || 0,
      data: data || []
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GENRE FILTER
app.get('/api/genre/:slug', async (req, res) => {
  const { slug } = req.params;
  const page = parseInt(req.query.page) || 1;
  const force = req.query.refresh === '1';
  const start = Date.now();
  try {
    const { data, cached } = await cachedScrape(cacheKey('genre', `${slug}:page${page}`), DEFAULT_TTL.genre, () => scrapeByGenre(slug, page), force);
    res.json({
      success: true,
      time_ms: Date.now() - start,
      cached,
      genre: slug,
      page: data.pagination?.current || page,
      has_next: data.pagination?.has_next || false,
      count: data.results?.length || 0,
      data: data.results || []
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DETAIL
app.get('/api/detail/:slug', async (req, res) => {
  const start = Date.now();
  const force = req.query.refresh === '1';
  try {
    const { data, cached } = await cachedScrape(cacheKey('detail', req.params.slug), DEFAULT_TTL.detail, () => scrapeDetail(req.params.slug), force);
    res.json({
      success: true,
      time_ms: Date.now() - start,
      cached,
      data
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// READ
app.get('/api/read/:slug', async (req, res) => {
  const start = Date.now();
  const force = req.query.refresh === '1';
  try {
    const { data, cached } = await cachedScrape(cacheKey('read', req.params.slug), DEFAULT_TTL.read, () => scrapeRead(req.params.slug), force);
    res.json({
      success: true,
      time_ms: Date.now() - start,
      cached,
      data
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// LATEST (Infinity Scroll Support)
app.get('/api/latest', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const force = req.query.refresh === '1';
  const start = Date.now();
  try {
    const { data, cached } = await cachedScrape(cacheKey('latest', `page${page}`), DEFAULT_TTL.latest, () => scrapeLatestPage(page), force);
    
    const hasNext = data.pagination?.has_next || false;
    const nextPage = hasNext ? (data.pagination?.current || page) + 1 : null;
    
    res.json({
      success: true,
      time_ms: Date.now() - start,
      cached,
      page: data.pagination?.current || page,
      total_pages: data.pagination?.total || 1,
      has_next: hasNext,
      next_url: hasNext ? `/api/latest?page=${nextPage}` : null,
      count: data.results?.length || 0,
      data: data.results || []
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// SEARCH
app.get('/api/search', async (req, res) => {
  const query = req.query.q;
  const force = req.query.refresh === '1';
  const start = Date.now();
  if (!query) {
    return res.status(400).json({ success: false, error: 'Parameter q diperlukan' });
  }
  try {
    const { data, cached } = await cachedScrape(cacheKey('search', query.toLowerCase().replace(/\s+/g, '-')), DEFAULT_TTL.search, () => scrapeSearch(query), force);
    res.json({
      success: true,
      time_ms: Date.now() - start,
      cached,
      count: data?.length || 0,
      data: data || []
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// === ADVANCED FILTER ===
app.get('/api/filter', async (req, res) => {
  const status = req.query.status || '';
  const type = req.query.type || '';
  const order = req.query.order || '';
  const genre = req.query.genre || '';
  const page = parseInt(req.query.page) || 1;
  const force = req.query.refresh === '1';
  const start = Date.now();

  try {
    const key = cacheKey('filter', `s:${status}_t:${type}_o:${order}_g:${genre}_p:${page}`);
    const ttl = DEFAULT_TTL.filter || DEFAULT_TTL.search || 3600;

    const { data, cached } = await cachedScrape(
      key,
      ttl,
      () => scrapeFilter({ status, type, order, genre, page }),
      force
    );

    res.json({
      success: true,
      time_ms: Date.now() - start,
      cached,
      filters: { status, type, order, genre },
      page: data.pagination?.current || page,
      has_next: data.pagination?.has_next || false,
      count: data.results?.length || 0,
      data: data.results || []
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health check
app.get('/api/health', async (req, res) => {
  res.json({
    success: true,
    redis: cache.isRedisReady(),
    timestamp: new Date().toISOString()
  });
});

// Clear cache
app.post('/api/cache/clear', async (req, res) => {
  await cache.flush();
  res.json({ success: true, message: 'Cache cleared' });
});

// Root
app.get('/', (req, res) => {
  res.json({
    message: 'ManhwaIndo Scraper API',
    endpoints: {
      home: '/api/home',
      updates: '/api/updates?page=1',
      genres: '/api/genres',
      genre: '/api/genre/:slug?page=1',
      latest: '/api/latest?page=1',
      detail: '/api/detail/:slug',
      read: '/api/read/:slug',
      search: '/api/search?q=keyword',
      filter: '/api/filter?status=ongoing&type=manhwa&order=popular&page=1', // <-- TAMBAHAN ENDPOINT FILTER
      health: '/api/health',
      'clear-cache': 'POST /api/cache/clear'
    },
    features: {
      cache: 'Redis + Memory Fallback',
      refresh: 'Add ?refresh=1 to force scrape'
    }
  });
});

// === VERCEL EXPORT ===
module.exports = app;

// === LOCAL DEV ONLY ===
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SERVER] http://0.0.0.0:${PORT}`);
    console.log(`[CACHE] Redis ready: ${cache.isRedisReady()}`);
  });
}
