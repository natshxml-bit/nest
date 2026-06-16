// src/scraper/filter.js
import * as cheerio from 'cheerio';
// 🔥 1. TAMBAHIN bersihinUrlGambar DI IMPORT INI
import { axiosNinja, cachedScrape, cacheKey, bersihinUrlGambar } from '../utils.js'; 

const BASE_URL = 'https://www.manhwaindo.my';

// ─── HELPER FUNCTIONS ───
function getImageSrc($, el) {
  const $el = $(el);
  const noscript = $el.find('noscript').html();
  if (noscript) {
    const m = noscript.match(/src=["']([^"']+)["']/);
    if (m && m[1] && !m[1].includes('svg')) return m[1];
  }
  return $el.find('img').attr('data-src') || $el.find('img').attr('src') || '';
}

function extractSlug(href) {
  return href.replace(BASE_URL, '').replace('/series/', '').replace('/project/', '').replace(/\/$/, '');
}

// ─── KODINGAN MURNI SCRAPER ───
async function rawScrapeFilter({ page = 1, status = '', type = '', order = '', genre = '' } = {}) {
  try {
    // 🔥 Build URL dinamis. Perhatiin genre pake genre[] sesuai form HTML web aslinya
    const genreQuery = genre ? `&genre[]=${genre}` : '';
    const url = `${BASE_URL}/series/?page=${page}&status=${status}&type=${type}&order=${order}${genreQuery}`;

    const { data: html } = await axiosNinja.get(url, { timeout: 30000 });
    const $ = cheerio.load(html);
    const results = [];

    // Loop komik (Pake selector listupd bs yang udah kita benerin sebelumnya)
    $('.listupd .bs').each((_, el) => {
      const item = $(el);
      const linkEl = item.find('a').first();
      
      const title = item.find('.tt').text().trim() || linkEl.attr('title') || '';
      const link = linkEl.attr('href') || '';
      
      if (title && link) {
        const slug = extractSlug(link);
        
        // 🔥 2. INI DIA RAHASIANYA! TANGKEP THUMBNAIL MENTAH, TERUS TEMBAK PAKE FILTER
        const rawThumb = getImageSrc($, item);
        const cleanThumb = bersihinUrlGambar(rawThumb); 
        
        const itemType = item.find('.typename').text().trim() || 'Unknown';
        const chapterText = item.find('.epxs').text().trim();        const rating = item.find('.numscore').text().trim() || '0';
        
        const isColored = item.find('.colored').length > 0;
        const isHot = item.find('.hotx').length > 0;

        results.push({
          title,
          slug,
          thumb: cleanThumb, // 🔥 Pake yang udah bersih, bye-bye noimg165px.png!
          type: itemType,
          latest_chapter: chapterText,
          rating,
          is_colored: isColored,
          is_hot: isHot,
          link
        });
      }
    });

    // ==========================================
    // PAGINATION
    // ==========================================
    const pageNav = $('.pagination');
    const currentPage = parseInt(pageNav.find('.current').text().trim()) || parseInt(page);
    let totalPages = currentPage;
    
    pageNav.find('a.page-numbers').each((_, el) => {
      const num = parseInt($(el).text().trim());
      if (!isNaN(num) && num > totalPages) {
        totalPages = num;
      }
    });

    const hasNext = pageNav.find('.next').length > 0 || String(pageNav.html()).includes('Next') || currentPage < totalPages;

    return {
      results,
      pagination: {
        current_page: currentPage,
        next_page: hasNext ? currentPage + 1 : null,
        total_pages: totalPages,
        has_next: hasNext,
        // Balikin URL API lu sesuai parameter yang dikasih
        next_url: hasNext ? `/filter?page=${currentPage + 1}&status=${status}&type=${type}&order=${order}&genre=${genre}` : null
      }
    };
  } catch (error) {
    console.error('[SCRAPE] Error filter:', error.message);
    return { results: [], pagination: { current_page: page, has_next: false } };
  }}

// ─── 🔥 FUNGSI UTAMA (CACHE WRAPPER) ───
async function scrapeFilter({ page = 1, status = '', type = '', order = '', genre = '' } = {}) {
  const start = Date.now();
  
  const safeStatus = status || 'all';
  const safeType = type || 'all';
  const safeOrder = order || 'all';
  const safeGenre = genre || 'all';
  
  // Bikin Cache Key dinamis dari semua kombinasi parameter
  const KEY = cacheKey('manga', 'filter', page, safeStatus, safeType, safeOrder, safeGenre);
  const TTL = 60 * 5; // ⏱️ Cache 5 menit cukup buat ngurangin beban

  const { data, cached } = await cachedScrape(KEY, TTL, () => rawScrapeFilter({ page, status, type, order, genre }));

  console.log(`[FILTER] P:${page} S:${safeStatus} T:${safeType} O:${safeOrder} G:${safeGenre} DONE in ${Date.now() - start}ms | Cached: ${cached}`);
  return data;
}

export { scrapeFilter };