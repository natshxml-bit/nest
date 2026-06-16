import * as cheerio from 'cheerio';
import { axiosNinja, cachedScrape, cacheKey, bersihinUrlGambar } from '../utils.js';

const BASE_URL = 'https://www.manhwaindo.my';

/* ============================================
   HELPERS
   ============================================ */

/**
 * Extract image source dari element
 * Priority: noscript > data-src > src
 */
function getImageSrc($, el) {
  const $el = $(el);
  
  // Coba ambil dari <noscript> dulu (URL asli)
  const noscript = $el.find('noscript').html();
  if (noscript) {
    const match = noscript.match(/src=["']([^"']+)["']/);
    if (match && match[1] && !match[1].includes('svg')) {
      return match[1].trim();
    }
  }
  
  // Fallback ke data-src atau src
  const img = $el.find('img');
  return img.attr('data-src') || img.attr('src') || '';
}

/**
 * Extract slug dari href
 */
function extractSlug(href) {
  if (!href) return '';
  return href
    .replace(BASE_URL, '')
    .replace('/series/', '')
    .replace('/project/', '')
    .replace(/\/$/, '');
}

/**
 * Fetch detail (rating & synopsis) dari halaman series
 */
async function getDetailData(slug) {
  try {
    const url = `${BASE_URL}/series/${slug}/`;
    const { data: html } = await axiosNinja.get(url, { timeout: 10000 });
    const $ = cheerio.load(html);
    
    const rating = $('.numscore').text().trim() 
      || $('.rating').text().trim()
      || $('[class*="score"]').first().text().trim()
      || '0';
    
    const synopsis = $('.entry-content p').first().text().trim() 
      || $('.synopsis p').first().text().trim()
      || $('[class*="synopsis"]').first().text().trim()
      || '';
    
    return { rating, synopsis };
  } catch (e) {
    console.error(`[Scrape Error] Gagal fetch detail untuk: ${slug}`);
    return { rating: '0', synopsis: '' };
  }
}

/* ============================================
   CORE SCRAPER (RAW - NO CACHE)
   ============================================ */

async function rawScrapeHome() {
  const { data: html } = await axiosNinja.get(BASE_URL, { timeout: 30000 });
  const $ = cheerio.load(html);

  const result = {
    popular_today: [],
    project_update: [],
    latest_update: [],
    recommendations: []
  };

  // ========== POPULAR TODAY ==========
  $('.bixbox').each((_, box) => {
    const h2 = $(box).find('h2').first().text().trim().toLowerCase();
    if (!h2.includes('popular')) return;

    $(box).find('.bsx').each((_, item) => {
      const $item = $(item);
      const link = $item.find('a').first();
      const title = $item.find('.tt').text().trim();
      
      if (link.length && title) {
        const href = link.attr('href') || '';
        const rating = $item.find('.numscore').text().trim();
        
        result.popular_today.push({
          title,
          slug: extractSlug(href),
          thumb: bersihinUrlGambar(getImageSrc($, item)),
          type: $item.find('.typename').text().trim() || 'Manhwa',
          latest_chapter: $item.find('.epxs').text().trim(),
          rating: rating || '0',
          link: href,
          is_colored: $item.find('.colored').length > 0,
          is_hot: $item.find('.hotx').length > 0,
          synopsis: '',
          needsFallback: !rating
        });
      }
    });
  });

  // ========== HELPER: PARSE UPDATE BOX ==========
  const parseUpdateBox = (boxEl, targetArray) => {
    $(boxEl).find('.utao').each((_, item) => {
      const $item = $(item);
      const seriesLink = $item.find('.luf > a.series').first();
      if (!seriesLink.length) return;

      const chapters = [];
      // ✅ FIX: iterate <li> biar bisa akses <a> dan sibling <span>
      $item.find('.luf ul li').each((_, li) => {
        const $li = $(li);
        const $a = $li.find('a').first();
        const timeText = $li.find('span').text().trim(); // <span> di luar <a>
        
        chapters.push({
          chapter_url: $a.attr('href') || '',
          chapter_title: $a.text().trim(),
          released_time: timeText
        });
      });

      const href = seriesLink.attr('href') || '';
      const typeClass = $item.find('.luf ul').attr('class');
      const imgu = $item.find('.imgu').first();
      
      targetArray.push({
        title: seriesLink.find('h4').text().trim(),
        slug: extractSlug(href),
        thumb: bersihinUrlGambar(getImageSrc($, imgu.length ? imgu[0] : item)),
        type: typeClass ? typeClass.trim() : 'Manhwa',
        latest_chapter: chapters[0]?.chapter_title || '',
        link: href,
        is_hot: $item.find('.hot').length > 0,
        is_new: $item.find('.new').length > 0,
        chapters
      });
    });
  };

  // ========== PROJECT UPDATE & LATEST UPDATE ==========
  $('.bixbox').each((_, box) => {
    const h2 = $(box).find('h2').first().text().trim().toLowerCase();
    if (h2.includes('project update')) parseUpdateBox(box, result.project_update);
    if (h2.includes('latest update')) parseUpdateBox(box, result.latest_update);
  });

  // ========== RECOMMENDATIONS ==========
  $('.bixbox').each((_, box) => {
    const h2 = $(box).find('h2').first().text().trim().toLowerCase();
    if (!h2.includes('recommendation')) return;

    $(box).find('.tab-pane .bsx').each((_, item) => {
      const $item = $(item);
      const link = $item.find('a').first();
      const title = $item.find('.tt').text().trim();
      
      if (link.length && title) {
        const href = link.attr('href') || '';
        const rating = $item.find('.numscore').text().trim();
        
        result.recommendations.push({
          title,
          slug: extractSlug(href),
          thumb: bersihinUrlGambar(getImageSrc($, item)),
          type: $item.find('.typename').text().trim() || 'Manhwa',
          latest_chapter: $item.find('.epxs').text().trim() || '',
          rating: rating || '0',
          link: href,
          is_colored: $item.find('.colored').length > 0,
          is_hot: $item.find('.hotx').length > 0
        });
      }
    });
  });

  // ========== FETCH DETAIL DATA (PARALLEL) ==========
  const detailPromises = result.popular_today.map(async (item) => {
    if (item.needsFallback || !item.synopsis) {
      const detail = await getDetailData(item.slug);
      item.synopsis = detail.synopsis;
      if (item.needsFallback) item.rating = detail.rating;
      delete item.needsFallback;
    }
  });
  await Promise.allSettled(detailPromises);

  return result;
}

/* ============================================
   MAIN EXPORT (WITH REDIS CACHE)
   ============================================ */

async function scrapeHome() {
  const start = Date.now();
  const KEY = cacheKey('manga', 'home');
  const TTL = 60 * 10; // ⏱️ Cache 10 menit

  const { data, cached } = await cachedScrape(KEY, TTL, rawScrapeHome);

  console.log(`[HOME] DONE in ${Date.now() - start}ms | Cached: ${cached}`);
  return data;
}

export { scrapeHome };
