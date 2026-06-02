import { scrapeSearch } from '../src/scraper/search.js';
import { cachedScrape, cacheKey } from '../src/utils.js';

export default async function handler(req, res) {
  try {
    const query = req.query.q;
    if (!query) return res.status(400).json({ success: false, error: 'Parameter q required' });
    const force = req.query.refresh === '1';
    const { data, cached } = await cachedScrape(cacheKey('search', query), 600, () => scrapeSearch(query), force);
    res.status(200).json({ success: true, cached, count: data.length, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}