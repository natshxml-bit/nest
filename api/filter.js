import { scrapeFilter } from '../src/scraper/filter.js';
import { cachedScrape, cacheKey } from '../src/utils.js';

export default async function handler(req, res) {
  try {
    const { status = '', type = '', order = '', genre = '', page = 1 } = req.query;
    const force = req.query.refresh === '1';
    const key = cacheKey('filter', `s:${status}_t:${type}_o:${order}_g:${genre}_p:${page}`);
    const { data, cached } = await cachedScrape(key, 1800, () => scrapeFilter({ status, type, order, genre, page }), force);
    res.status(200).json({ success: true, cached, filters: { status, type, order, genre }, page, has_next: data.pagination?.has_next || false, data: data.results || [] });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}