import { scrapePopular } from '../src/scraper/populer.js';
import { cachedScrape, cacheKey } from '../src/utils.js';

export default async function handler(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const force = req.query.refresh === '1';
    const { data, cached } = await cachedScrape(cacheKey('popular', `page${page}`), 1800, () => scrapePopular(page), force);
    const hasNext = data.pagination?.has_next || false;
    res.status(200).json({ success: true, cached, page, has_next: hasNext, data: data.results || [] });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}