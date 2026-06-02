import { scrapeByGenre } from '../../src/scraper/genre.js';
import { cachedScrape, cacheKey } from '../../src/utils.js';

export default async function handler(req, res) {
  try {
    const { slug } = req.query;
    const page = parseInt(req.query.page) || 1;
    const force = req.query.refresh === '1';
    const { data, cached } = await cachedScrape(cacheKey('genre', `${slug}:page${page}`), 1800, () => scrapeByGenre(slug, page), force);
    res.status(200).json({ success: true, cached, genre: slug, page, has_next: data.pagination?.has_next || false, data: data.results || [] });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}