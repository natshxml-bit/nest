import * as cheerio from 'cheerio';
import { axiosNinja, cachedScrape, cacheKey } from '../utils.js'; // 🔥 Import senjata cache lo Bre

const BASE_URL = 'https://www.manhwaindo.my';

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

// ─── KODINGAN UTAMA SCRAPER (MURNI SCRAPE) ───
async function rawScrapeHome() {
  const { data: html } = await axiosNinja.get(BASE_URL, { timeout: 30000 });
  const $ = cheerio.load(html);

  const result = {
    popular_today: [],
    latest_update: [],
    project_update: []
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
          thumb: getImageSrc($, item),
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

  // Fetch detail barengan biar ngebut
  const detailPromises = result.popular_today.map(async (item) => {
    if (item.needsFallback || !item.synopsis) {
      const detail = await getDetailData(item.slug);
      item.synopsis = detail.synopsis;
      if (item.needsFallback) item.rating = detail.rating;
      delete item.needsFallback;
    }
  });
  await Promise.allSettled(detailPromises);

  // ========== LATEST UPDATE ==========
  $('.bixbox').each((_, box) => {
    const h2 = $(box).find('h2').first().text().trim().toLowerCase();
    if (!h2.includes('latest update')) return;

    $(box).find('.utao').each((_, item) => {
      const $item = $(item);
      const seriesLink = $item.find('.luf > a.series').first();
      if (!seriesLink.length) return;

      const chapters = [];
      $item.find('.luf ul li a').each((_, a) => {
        const $a = $(a);
        const timeText = $a.find('span').text().trim();
        const fullText = $a.text().trim();
        chapters.push({
          chapter_url: $a.attr('href') || '',
          chapter_title: fullText.replace(timeText, '').trim(),
          released_time: timeText
        });
      });

      const href = seriesLink.attr('href') || '';
      result.latest_update.push({
        title: seriesLink.find('h4').text().trim(),
        slug: extractSlug(href),
        thumb: getImageSrc($, $item.find('.imgu').length ? $item.find('.imgu')[0] : item),
        type: 'Manhwa',
        latest_chapter: chapters[0]?.chapter_title || '',
        link: href,
        chapters
      });
    });
  });

  // ========== PROJECT UPDATE ==========
  $('.bixbox').each((_, box) => {
    const h2 = $(box).find('h2').first().text().trim().toLowerCase();
    if (!h2.includes('project update')) return;

    $(box).find('.utao').each((_, item) => {
      const $item = $(item);
      const seriesLink = $item.find('.luf > a.series').first();
      if (!seriesLink.length) return;

      const chapters = [];
      $item.find('.luf ul li a').each((_, a) => {
        const $a = $(a);
        const timeText = $a.find('span').text().trim();
        const fullText = $a.text().trim();
        chapters.push({
          chapter_url: $a.attr('href') || '',
          chapter_title: fullText.replace(timeText, '').trim(),
          released_time: timeText
        });
      });

      const href = seriesLink.attr('href') || '';
      result.project_update.push({
        title: seriesLink.find('h4').text().trim(),
        slug: extractSlug(href),
        thumb: getImageSrc($, $item.find('.imgu').length ? $item.find('.imgu')[0] : item),
        type: 'Manhwa',
        latest_chapter: chapters[0]?.chapter_title || '',
        link: href,
        chapters
      });
    });
  });

  return result;
}

// ─── 🔥 FUNGSI UTAMA YANG DIEKSPOR (OTOMATIS REDIS CACHE) ───
async function scrapeHome() {
  const start = Date.now();
  const KEY = cacheKey('manga', 'home');
  const TTL = 60 * 10; // ⏱️ Simpen di cache selama 10 menit

  // Panggil wrapper cachedScrape bawaan lo Bre
  const { data, cached } = await cachedScrape(KEY, TTL, rawScrapeHome);

  console.log(`[HOME] DONE in ${Date.now() - start}ms | Cached: ${cached}`);
  return data;
}

export { scrapeHome };
