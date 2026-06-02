import { scrapeHome } from '../src/scraper/home.js';
import { cachedScrape, cacheKey } from '../src/utils.js';

export default async function handler(req, res) {
  try {
    const force = req.query.refresh === '1';
    const { data, cached } = await cachedScrape(cacheKey('home'), 1800, scrapeHome, force);
    res.status(200).json({ success: true, cached, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}