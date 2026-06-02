import { scrapeUpdates } from '../src/scraper/update.js';
import { cachedScrape, cacheKey } from '../src/utils.js';

export default async function handler(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const force = req.query.refresh === '1';
    const { data, cached } = await cachedScrape(cacheKey('updates', `page${page}`), 1800, () => scrapeUpdates(page), force);
    res.status(200).json({ success: true, cached, page, has_next: data.pagination?.has_next || false, data: data.results || [] });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}