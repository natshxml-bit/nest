import express from 'express';
import { scrapeHome } from './scraper/home.js';
import { scrapeUpdates } from './scraper/update.js';
import { scrapeSearch } from './scraper/search.js';
import { scrapeDetail } from './scraper/detail.js';
import { scrapeRead } from './scraper/read.js';
import { scrapeFilter } from './scraper/filter.js';
import { scrapeGenreList } from './scraper/genre.js'; // 🔥 Import genre.js lu

const app = express();
const PORT = process.env.PORT || 3000;

// 🔥 Biar semua res.json() otomatis pretty-print 🔥
app.set('json spaces', 2);

app.use(express.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// === ROUTES ===

app.get('/home', async (req, res) => {
  try {
    const data = await scrapeHome();
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Route Popular dialihin ke scrapeFilter
app.get('/popular', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const data = await scrapeFilter({ page, order: 'popular' });
    res.json({ success: true, page, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Route Latest dialihin ke scrapeFilter
app.get('/latest', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const data = await scrapeFilter({ page, order: 'update' });
    res.json({ success: true, page, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/updates', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const data = await scrapeUpdates(page);
    res.json({ success: true, page, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/search', async (req, res) => {
  try {
    const q = req.query.q;
    if (!q) return res.status(400).json({ success: false, error: 'Parameter q required' });
    const data = await scrapeSearch(q);
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/detail/:slug', async (req, res) => {
  try {
    const data = await scrapeDetail(req.params.slug);
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/read/:slug', async (req, res) => {
  try {
    const data = await scrapeRead(req.params.slug);
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 🔥 Route List Genre
app.get('/genres', async (req, res) => {
  try {
    const data = await scrapeGenreList();
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Route Filter Utama
app.get('/filter', async (req, res) => {
  try {
    const { status = '', type = '', order = '', genre = '', page = 1 } = req.query;
    const data = await scrapeFilter({ page: parseInt(page), status, type, order, genre });
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
      '/home',
      '/popular?page=1',
      '/latest?page=1',
      '/updates?page=1',
      '/search?q=keyword',
      '/detail/:slug',
      '/read/:slug',
      '/genres',
      '/filter?status=ongoing&type=manhwa&order=popular&genre=3&page=1'
    ]
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[SERVER] Running on http://0.0.0.0:${PORT}`);
});
