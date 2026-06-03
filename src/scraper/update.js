// src/scraper/update.js
import { axiosNinja, cachedScrape, cacheKey } from '../utils.js'; // 🔥 Import senjata cache lo!
import * as cheerio from 'cheerio';

const BASE_URL = 'https://www.manhwaindo.my';

/** Extract URL dari HTML string */
function extractUrl(html) {
  if (!html || typeof html !== 'string') return '';
  if (!html.includes('<')) return html;
  const match = html.match(/src=["']([^"']+)["']/i);
  return match ? match[1] : '';
}

/** Strip HTML tags */
function stripHtml(html) {
  if (!html || typeof html !== 'string') return '';
  return html.replace(/<<[^>]*>/g, '').trim();
}

/** Scrape rating — FAST: timeout 3s, cache-friendly */
async function scrapeRating(detailUrl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000); // 3s max

  try {
    const { data: html } = await axiosNinja.get(detailUrl, {
      timeout: 3000,
      signal: controller.signal,
    });
    
    clearTimeout(timeout);
    const $ = cheerio.load(html);
    
    // Fast selectors
    const fastSelectors = [
      '.ts-rating', 
      '.numscore', 
      '.rating',
      '.score',
      '[class*="rating"]',
    ];
    
    for (const selector of fastSelectors) {
      const el = $(selector).first();
      if (el.length) {
        const text = el.text().trim();
        const match = text.match(/(\d+(\.\d+)?)/);
        if (match) return match[1];
      }
    }
    
    return '0';
  } catch (err) {
    clearTimeout(timeout);
    return '0';
  }
}

/** Scrape ratings — ULTRA FAST: concurrency 10, no delay */
async function scrapeRatingsFast(items) {
  const CONCURRENCY = 10;
  const results = new Map();
  
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    const batch = items.slice(i, i + CONCURRENCY);
    const promises = batch.map(item => 
      scrapeRating(item.link).then(rating => {
        results.set(item.link, rating);
      })
    );
    await Promise.allSettled(promises);
  }
  
  return results;
}

// ─── KODINGAN MURNI SCRAPER ───
async function rawScrapeUpdates(page = 1) {
  const url = page === 1 
    ? `${BASE_URL}/project-updates/` 
    : `${BASE_URL}/project-updates/page/${page}/`;

  const { data: html } = await axiosNinja.get(url, {
    timeout: 15000,
  });

  const $ = cheerio.load(html);
  const rawResults = [];

  $('.uta, .bsx, .page-item-detail, .listupd .bsx, .item-thumb').each((_, el) => {
    const item = $(el);
    
    const img = item.find('img');
    let thumb = img.attr('data-src') || img.attr('data-lazy-src') || img.attr('src') || '';
    
    if (!thumb || thumb.startsWith('data:')) {
      const noscript = item.find('noscript').html();
      if (noscript) {
        const match = noscript.match(/src=["'](https?:\/\/[^"']+)["']/i);
        if (match) thumb = match[1];
      }
    }

    const linkEl = item.find('a').first();
    const title = linkEl.attr('title') || linkEl.text().trim();
    const link = linkEl.attr('href') || '';
    
    let slug = link.replace(BASE_URL, '').replace(/^\//, '').replace(/\/$/, '');
    slug = slug.replace(/^series\//, '');

    const typeRaw = item.find('.type, .typez, .typename, .limit').first().text().trim().toUpperCase() || 'MANHWA';
    const type = stripHtml(typeRaw).split(/\s+/)[0];

    const chapterEl = item.find('.epxs, .epx, .chapter, [class*="chapter"]').first();
    const chapterText = chapterEl.text().trim();
    const chapterMatch = chapterText.match(/Chapter\s*(\d+(\.\d+)?)/i);
    const chapter = chapterMatch ? `Chapter ${chapterMatch[1]}` : chapterText || 'N/A';

    const time = item.find('.time, .date, [class*="time"], [class*="ago"]').first().text().trim();

    const isColor = item.find('.colored, .colx, [class*="color"]').length > 0;
    const isHot = item.find('.hotx, .hot, [class*="hot"]').length > 0;

    const cleanThumb = extractUrl(thumb);

    if (title && cleanThumb) {
      rawResults.push({ title, slug, thumb: cleanThumb, type, chapter, time: time || '', badges: [...(isColor?['color']:[]), ...(isHot?['hot']:[])], link });
    }
  });

  console.log(`[Scraper] Fast fetching ${rawResults.length} ratings...`);
  const ratingMap = await scrapeRatingsFast(rawResults);

  const results = rawResults.map(item => ({
    ...item,
    rating: ratingMap.get(item.link) || '0'
  }));

  const pageNav = $('.pagination');
  const currentPage = parseInt(pageNav.find('.current').text().trim()) || page;
  let totalPages = currentPage;
  pageNav.find('a.page-numbers, span.page-numbers').each((_, el) => {
    const num = parseInt($(el).text().trim());
    if (!isNaN(num) && num > totalPages) totalPages = num;
  });

  const hasNext = pageNav.find('.next').length > 0 || pageNav.find('a[rel="next"]').length > 0 || currentPage < totalPages;

  return {
    results,
    pagination: { current: currentPage, next_page: hasNext ? currentPage + 1 : null, total: totalPages, has_next: hasNext, next_url: hasNext ? `/api/updates?page=${currentPage + 1}` : null }
  };
}

// ─── 🔥 FUNGSI UTAMA (CACHE WRAPPER) ───
async function scrapeUpdates(page = 1) {
  const start = Date.now();
  // Key dibedain tiap halaman, misal: manga:updates:1, manga:updates:2
  const KEY = cacheKey('manga', 'updates', page);
  const TTL = 60 * 10; // Cache 10 menit

  // Panggil wrapper cachedScrape, kasih arrow function biar tau page ke berapa
  const { data, cached } = await cachedScrape(KEY, TTL, () => rawScrapeUpdates(page));

  console.log(`[UPDATES] Page ${page} DONE in ${Date.now() - start}ms | Cached: ${cached}`);
  return data;
}

export { scrapeUpdates };
