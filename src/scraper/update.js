// src/scraper/update.js
import * as cheerio from 'cheerio';
import { axiosNinja } from '../utils.js'; // 🔥 Cache tetep dicopot total biar update real-time

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

/** Scrape rating — FAST: timeout 3s */
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
    
    // 🔥 FIX SCOPING: Cuma nyari rating di kotak info atas biar ga nyasar ke Related Series
    const infoArea = $('.postbody .main-info, .info-left, .rating.bixbox');
    const fastSelectors = ['.numscore', '.rating .num', '.score', '[itemprop="ratingValue"]'];
    
    for (const selector of fastSelectors) {
      const el = infoArea.find(selector).first();
      if (el.length) {
        let text = el.text().trim() || el.attr('content') || '';
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

/** Scrape ratings — ULTRA FAST: concurrency 10 */
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

// ─── KODINGAN UTAMA SCRAPER TANPA CACHE ───
async function scrapeUpdates(page = 1) {
  const start = Date.now();
  const url = page === 1 
    ? `${BASE_URL}/project-updates/` 
    : `${BASE_URL}/project-updates/page/${page}/`;

  const { data: html } = await axiosNinja.get(url, {
    timeout: 15000,
  });

  const $ = cheerio.load(html);
  const rawResults = [];

  $('.listupd .bs').each((_, el) => {
    const item = $(el);
    const linkEl = item.find('a').first();
    
    const title = item.find('.tt').text().trim() || linkEl.attr('title') || '';
    const link = linkEl.attr('href') || '';
    
    if (title && link) {
      const slug = extractSlug(link);
      const thumb = getImageSrc($, item);
      const type = item.find('.typename').text().trim() || 'Manhwa';
      const chapterText = item.find('.epxs').text().trim();
      const time = item.find('.epxdate').text().trim();
      
      const isColored = item.find('.colored').length > 0;
      const isHot = item.find('.hotx').length > 0;

      rawResults.push({ 
        title, 
        slug, 
        thumb, 
        type, 
        latest_chapter: chapterText, 
        time, 
        is_colored: isColored,
        is_hot: isHot,
        link 
      });
    }
  });

  console.log(`[Scraper] Fast fetching ${rawResults.length} ratings...`);
  const ratingMap = await scrapeRatingsFast(rawResults);

  const results = rawResults.map(item => ({
    ...item,
    rating: ratingMap.get(item.link) || '0'
  }));

  // ==========================================
  // PAGINATION
  // ==========================================
  const pageNav = $('.pagination');
  const currentPage = parseInt(pageNav.find('.current').text().trim()) || page;
  let totalPages = currentPage;
  
  pageNav.find('a.page-numbers').each((_, el) => {
    const text = $(el).text().trim();
    const num = parseInt(text);
    if (!isNaN(num) && num > totalPages) {
      totalPages = num;
    }
  });

  const hasNext = pageNav.find('.next').length > 0 || String(pageNav.html()).includes('Berikutnya') || currentPage < totalPages;

  console.log(`[UPDATES] Page ${page} DONE in ${Date.now() - start}ms | No Cache`);

  return {
    results,
    pagination: { 
      current_page: currentPage, 
      next_page: hasNext ? currentPage + 1 : null, 
      total_pages: totalPages, 
      has_next: hasNext, 
      next_url: hasNext ? `/updates?page=${currentPage + 1}` : null 
    }
  };
}

export { scrapeUpdates };
