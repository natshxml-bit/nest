// src/scraper/detail.js
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
async function rawScrapeDetail(slug) {
  const url = `${BASE_URL}/series/${slug}/`;
  
  const { data: html } = await axiosNinja.get(url, { timeout: 30000 });
  const $ = cheerio.load(html);

  const result = {
    title: '',
    alternative_title: '',
    thumb: '',
    rating: '',
    status: '',
    type: '',
    author: '',
    artist: '',
    released: '',
    serialization: '', 
    posted_by: '',
    posted_on: '',
    updated_on: '',
    views: '',
    genres: [],
    synopsis: '',
    chapters: [],
    related_series: []
  };
  // Title
  result.title = $('h1.entry-title').text().trim();

  // 🔥 2. IMAGE (THUMBNAIL UTAMA) - LANGSUNG DISARING!
  const thumb = $('.thumb img, .seriestuimg img, .ts-image img, .wp-post-image').first();
  const rawThumb = thumb.attr('data-src') || thumb.attr('src') || '';
  result.thumb = bersihinUrlGambar(rawThumb); 

  // Rating (Dibatasi di area atas biar ga nyomot ratingnya Related Series)
  const infoArea = $('.postbody .main-info, .info-left, .rating.bixbox');
  const ratingSelectors = ['.num', '.numscore', '.score', '[itemprop="ratingValue"]'];
  
  for (const sel of ratingSelectors) {
    const el = infoArea.find(sel).first();
    let text = el.text().trim() || el.attr('content') || '';
    text = text.replace(/[^\d.]/g, '');
    const num = parseFloat(text);
    if (!isNaN(num) && num >= 0 && num <= 10) {
      result.rating = num.toString();
      break;
    }
  }
  if (!result.rating) result.rating = '0';

  // ==========================================
  // METADATA (AUTHOR, ARTIST, STATUS, ETC)
  // ==========================================
  $('.tsinfo .imptdt, .info-right .imptdt, .imptdt').each((_, el) => {
    const $el = $(el);
    const label = $el.contents().filter(function() {
      return this.nodeType === 3;
    }).text().trim().toLowerCase();
    
    const value = $el.find('a, span, i, time, div, strong, b').last().text().trim();
    
    if (label.includes('status')) result.status = value;
    if (label.includes('type') || label.includes('format')) result.type = value;
    if (label.includes('author')) result.author = value;
    if (label.includes('artist')) result.artist = value;
    if (label.includes('released')) result.released = value;
    if (label.includes('serialization')) result.serialization = value; 
    if (label.includes('updated on')) result.updated_on = value;
    if (label.includes('posted by')) result.posted_by = value;
    if (label.includes('posted on')) result.posted_on = value;
    if (label.includes('views')) result.views = value;
  });

  // Fallback metadata jika method pertama gagal
  if (!result.status || !result.type || !result.author) {
    $('.fmed, .flex-wrap, .flex, .info-item, .meta-item').each((_, el) => {      const $el = $(el);
      const label = $el.find('b, .label, strong, .name, dt, .info-label, span:first-child').first().text().trim().toLowerCase();
      const value = $el.find('span:last-child, a:last-child, .value, dd, .info-value, div:last-child').last().text().trim();
      
      if (label.includes('status') && !result.status) result.status = value;
      if ((label.includes('type') || label.includes('format')) && !result.type) result.type = value;
      if (label.includes('author') && !result.author) result.author = value;
      if (label.includes('artist') && !result.artist) result.artist = value;
      if (label.includes('serialization') && !result.serialization) result.serialization = value;
    });
  }

  // Pisahin Artist dari Author jika digabung pake koma/slash
  if (!result.artist && result.author) {
    const parts = result.author.split(/,|\/|&/);
    for (const part of parts) {
      if (part.toLowerCase().includes('art') || part.toLowerCase().includes('illustration')) {
        result.artist = part.replace(/\s*\([^)]*\)/g, '').trim();
        result.author = result.author.replace(part, '').replace(/,\s*,/g, ',').replace(/^,|,$/g, '').trim();
        break;
      }
    }
  }

  // Alternative title
  const altEl = $('.alternative, .alternative-title, .wd-full:contains("Alternative")').first();
  result.alternative_title = altEl.text().replace(/Alternative\s*[Tt]itles?:?/, '').trim();

  // Genres
  $('.mgen a, .genx a, .genre a, [href*="/genres/"]').each((_, el) => {
    const name = $(el).text().trim();
    const href = $(el).attr('href') || '';
    if (name && !result.genres.find(g => g.name === name)) {
      result.genres.push({ name, url: href });
    }
  });

  // Synopsis
  const synopsisSelectors = [
    '.entry-content.entry-content-single p',
    '.manga-excerpt',
    '.summary',
    '.synopsis',
    '[itemprop="description"]',
    '.wd-full:contains("Synopsis") .entry-content'
  ];

  for (const sel of synopsisSelectors) {
    const el = $(sel).first();
    if (el.length && el.text().trim()) {      result.synopsis = el.text().trim();
      break;
    }
  }

  // Chapters
  const chapterList = $('#chapterlist ul li, .eplister ul li, .chapters li, .chapter-list li, .clstyle li');
  if (chapterList.length) {
    chapterList.each((i, el) => {
      const $el = $(el);
      const link = $el.find('.eph-num a, a').first();
      
      if (link.length) {
        const href = link.attr('href') || '';
        const chapterNum = $el.find('.chapternum, .epl-num, .chapter-num, .num').text().trim();
        const chapterDate = $el.find('.chapterdate, .epl-date, .chapter-date, .date').text().trim();

        result.chapters.push({
          index: i + 1,
          chapter_url: href,
          chapter_number: chapterNum || `Chapter ${i + 1}`,
          release_date: chapterDate,
          slug: href.replace(BASE_URL, '').replace(/^\//, '').replace(/\/$/, '')
        });
      }
    });
  }

  // Sort chapters dari urutan paling awal (Chapter 1) ke Chapter terbaru
  result.chapters.sort((a, b) => {
    const numA = parseFloat(a.chapter_number.match(/\d+(\.\d+)?/)?.[0] || 0);
    const numB = parseFloat(b.chapter_number.match(/\d+(\.\d+)?/)?.[0] || 0);
    return numB - numA;
  });
  result.chapters.forEach((ch, i) => ch.index = i + 1);

  // Related Series
  $('.bixbox').each((_, box) => {
    const h2 = $(box).find('h2').first().text().trim().toLowerCase();
    if (!h2.includes('related')) return;

    $(box).find('.bsx').each((_, item) => {
      const $item = $(item);
      const link = $item.find('a').first();
      const title = $item.find('.tt').text().trim();
      
      if (link.length && title) {
        const href = link.attr('href') || '';
        const rating = $item.find('.numscore').text().trim();
                result.related_series.push({
          title,
          slug: extractSlug(href),
          // 🔥 3. RELATED SERIES THUMBNAIL - LANGSUNG DISARING JUGA!
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

  return result;
}

// ─── 🔥 FUNGSI UTAMA (CACHE WRAPPER) ───
async function scrapeDetail(slug) {
  const start = Date.now();
  const KEY = cacheKey('manga', 'detail', slug);
  const TTL = 60 * 15;

  const { data, cached } = await cachedScrape(KEY, TTL, () => rawScrapeDetail(slug));

  console.log(`[DETAIL] ${slug} DONE in ${Date.now() - start}ms | Cached: ${cached}`);
  return data;
}

export { scrapeDetail };