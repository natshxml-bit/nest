// src/scraper/filter.js
import { axiosNinja, cachedScrape, cacheKey } from '../utils.js'; // 🔥 Tambahin Cache Tools
import * as cheerio from 'cheerio';

function fixImageUrl(url) {
  if (!url) return '';
  if (!url.startsWith('http')) return 'https://www.manhwaindo.my' + (url.startsWith('/') ? '' : '/') + url;
  return url;
}

function extractSlugFromUrl(url) {
  try {
    const pathname = new URL(url, 'https://www.manhwaindo.my').pathname;
    const parts = pathname.split('/').filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  } catch (e) {}
  return url.replace(/\/$/, '');
}

// ─── KODINGAN MURNI SCRAPER ───
async function rawScrapeFilter({ page = 1, status = '', type = '', order = '' } = {}) {
  try {
    // URL filter all-in-one
    const url = `https://www.manhwaindo.my/series/?page=${page}&status=${status}&type=${type}&order=${order}`;

    const response = await axiosNinja.get(url, { timeout: 30000 });
    const html = response.data;
    const $ = cheerio.load(html);
    const results = [];

    $('.bsx, .page-item-detail').each((_, item) => {
      const el = $(item);
      const imgEl = el.find('img').first();
      let cover = imgEl.attr('data-src') || imgEl.attr('data-lazy-src') || imgEl.attr('src') || '';
      cover = fixImageUrl(cover);

      let linkEl = el.find('a[title]').first();
      if (!linkEl.length) linkEl = el.find('.tt a, h2 a, h3 a').first();

      const title = linkEl.attr('title') || linkEl.text().trim();
      const link = linkEl.attr('href') || '';
      const slug = extractSlugFromUrl(link);
      const typeSpan = el.find('span.typename').first();
      const itemType = typeSpan.text().trim().toUpperCase();
      const latest_chapter = el.find('.epxs, .chapter').first().text().trim();

      if (title && slug) {
        results.push({
          title,
          slug,
          thumb: cover || 'https://placehold.co/300x400/1a1a1a/666?text=No+Image',
          type: itemType,
          latest_chapter,
          link
        });
      }
    });

    const nextEl = $('.pagination a.next, a[rel="next"], .pagination .next');
    const hasNext = nextEl.length > 0 && !nextEl.hasClass('disabled');

    return {
      results,
      pagination: {
        current: parseInt(page),
        has_next: hasNext
      }
    };
  } catch (error) {
    console.error('[SCRAPE] Error filter:', error.message);
    return {
      results: [],
      pagination: { current: page, has_next: false }
    };
  }
}

// ─── 🔥 FUNGSI UTAMA (CACHE WRAPPER) ───
async function scrapeFilter({ page = 1, status = '', type = '', order = '' } = {}) {
  const start = Date.now();
  
  // Bikin Cache Key dinamis dari semua kombinasi parameter
  // Misal jadinya: manga:filter:1:ongoing:manhwa:popular
  const safeStatus = status || 'all';
  const safeType = type || 'all';
  const safeOrder = order || 'all';
  const KEY = cacheKey('manga', 'filter', page, safeStatus, safeType, safeOrder);
  
  const TTL = 60 * 5; // ⏱️ Cache 5 menit aja cukup buat fitur filter

  // Panggil wrapper cachedScrape
  const { data, cached } = await cachedScrape(KEY, TTL, () => rawScrapeFilter({ page, status, type, order }));

  console.log(`[FILTER] P:${page} S:${safeStatus} T:${safeType} O:${safeOrder} DONE in ${Date.now() - start}ms | Cached: ${cached}`);
  return data;
}

export { scrapeFilter };
