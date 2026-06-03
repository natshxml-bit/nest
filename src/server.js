import express from 'express';
import { scrapeHome } from './scraper/home.js';
import { scrapePopular } from './scraper/populer.js';
import { scrapeLatestPage } from './scraper/latest.js';
import { scrapeUpdates } from './scraper/update.js';
import { scrapeSearch } from './scraper/search.js';
import { scrapeDetail } from './scraper/detail.js';
import { scrapeRead } from './scraper/read.js';
import { scrapeGenres, scrapeByGenre } from './scraper/genre.js';
import { scrapeFilter } from './scraper/filter.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// === ROUTES ===

app.get('/api/home', async (req, res) => {
  try {
    const data = await scrapeHome();
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/popular', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const data = await scrapePopular(page);
    res.json({ success: true, page, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/latest', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const data = await scrapeLatestPage(page);
    res.json({ success: true, page, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/updates', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const data = await scrapeUpdates(page);
    res.json({ success: true, page, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/search', async (req, res) => {
  try {
    const q = req.query.q;
    if (!q) return res.status(400).json({ success: false, error: 'Parameter q required' });
    const data = await scrapeSearch(q);
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/detail/:slug', async (req, res) => {
  try {
    const data = await scrapeDetail(req.params.slug);
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/read/:slug', async (req, res) => {
  try {
    const data = await scrapeRead(req.params.slug);
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/genres', async (req, res) => {
  try {
    const data = await scrapeGenres();
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/genre/:slug', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const data = await scrapeByGenre(req.params.slug, page);
    res.json({ success: true, page, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/filter', async (req, res) => {
  try {
    const { status = '', type = '', order = '', page = 1 } = req.query;
    const data = await scrapeFilter({ page: parseInt(page), status, type, order });
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/', (req, res) => {
  res.json({
    author: 'natshi',
    message: 'Gunakan secara pintar',
    endpoints: [
      '/api/home',
      '/api/popular?page=1',
      '/api/latest?page=1',
      '/api/updates?page=1',
      '/api/search?q=keyword',
      '/api/detail/:slug',
      '/api/read/:slug',
      '/api/genres',
      '/api/genre/:slug?page=1',
      '/api/filter?status=ongoing&type=manhwa&order=popular&page=1'
    ]
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[SERVER] Running on http://0.0.0.0:${PORT}`);
});
