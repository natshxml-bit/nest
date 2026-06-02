import { scrapeRead } from '../../src/scraper/read.js';
import { cachedScrape, cacheKey } from '../../src/utils.js';

export default async function handler(req, res) {
  try {
    const { slug } = req.query;
    const force = req.query.refresh === '1';
    const { data, cached } = await cachedScrape(cacheKey('read', slug), 1800, () => scrapeRead(slug), force);
    res.status(200).json({ success: true, cached, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}