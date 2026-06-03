// src/scraper/detail.js
import * as cheerio from 'cheerio';
import { axiosNinja } from '../utils.js'; // 🔥 Import axios sakti dari utils

const BASE_URL = 'https://www.manhwaindo.my';

async function scrapeDetail(slug) {
  const url = `${BASE_URL}/series/${slug}/`;
  
  // 🔥 Tinggal panggil axiosNinja, otomatis bawa header anti-403 dan timeout!
  const { data: html } = await axiosNinja.get(url);
  
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
    genres: [],
    synopsis: '',
    chapters: []
  };

  // Title
  result.title = $('h1.entry-title').text().trim();

  // Image
  const thumb = $('.thumb img, .seriestuimg img, .ts-image img, .wp-post-image').first();
  result.thumb = thumb.attr('data-src') || thumb.attr('src') || '';

  // Rating
  const ratingSelectors = ['.numscore', '.rating .num', '.score', '[itemprop="ratingValue"]', '.ratingValue', '.rvalue'];
  for (const sel of ratingSelectors) {
    const el = $(sel).first();
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
  // AUTHOR & ARTIST — MULTI METHOD SCRAPER
  // ==========================================

  // Method 1: .tsinfo .imptdt (Madara theme standard)
  $('.tsinfo .imptdt, .info-right .imptdt, .imptdt').each((_, el) => {
    const $el = $(el);
    const label = $el.contents().filter(function() {
      return this.nodeType === 3;
    }).text().trim().toLowerCase();
    const value = $el.find('a, span, i, div, strong, b').last().text().trim();
    
    if (label.includes('status')) result.status = value;
    if (label.includes('type') || label.includes('format')) result.type = value;
    if (label.includes('author')) result.author = value;
    if (label.includes('artist')) result.artist = value;
  });

  // Method 2: .fmed / .flex-wrap (MangaStream / custom flex)
  if (!result.status || !result.type || !result.author || !result.artist) {
    $('.fmed, .flex-wrap, .flex, .info-item, .meta-item').each((_, el) => {
      const $el = $(el);
      const label = $el.find('b, .label, strong, .name, dt, .info-label, span:first-child').first().text().trim().toLowerCase();
      const value = $el.find('span:last-child, a:last-child, .value, dd, .info-value, div:last-child').last().text().trim();
      
      if (label.includes('status') && !result.status) result.status = value;
      if ((label.includes('type') || label.includes('format')) && !result.type) result.type = value;
      if (label.includes('author') && !result.author) result.author = value;
      if (label.includes('artist') && !result.artist) result.artist = value;
    });
  }

  // Method 3: table / dl dt / list
  if (!result.status || !result.type || !result.author || !result.artist) {
    $('table tr, dl dt, .info-content li, .series-info li, .detail-list li').each((_, el) => {
      const $el = $(el);
      const text = $el.text().toLowerCase();
      const value = $el.next().text().trim() || $el.find('+ dd').text().trim() || $el.find('td:last-child, span:last-child, .value').text().trim();
      
      if (text.includes('status') && !result.status) result.status = value;
      if ((text.includes('type') || text.includes('format')) && !result.type) result.type = value;
      if (text.includes('author') && !result.author) result.author = value;
      if (text.includes('artist') && !result.artist) result.artist = value;
    });
  }

  // Method 4: GENERIC — cari semua elemen yang textnya mengandung Author/Artist
  if (!result.author || !result.artist) {
    const scanElements = [
      '.tsinfo', '.info-right', '.series-info', '.detail-info', '.manga-info', 
      '.post-content', '.entry-content', '.summary', '.infox', '.wd-full'
    ];
    
    scanElements.forEach(selector => {
      $(selector).each((_, el) => {
        const text = $(el).text();
        
        if (!result.author) {
          const authorMatch = text.match(/author\s*[:\-]\s*([^\n\r<<]+)/i);
          if (authorMatch) result.author = authorMatch[1].trim();
        }
        if (!result.artist) {
          const artistMatch = text.match(/artist\s*[:\-]\s*([^\n\r<<]+)/i);
          if (artistMatch) result.artist = artistMatch[1].trim();
        }
      });
    });
  }

  // Method 5: RAW REGEX FALLBACK pada HTML mentah
  if (!result.author) {
    const authorRegex = /author\s*[:\-]\s*<<[^>]*>([^<<]+)/i;
    const match = html.match(authorRegex);
    if (match) result.author = match[1].trim();
  }
  if (!result.artist) {
    const artistRegex = /artist\s*[:\-]\s*<<[^>]*>([^<<]+)/i;
    const match = html.match(artistRegex);
    if (match) result.artist = match[1].trim();
  }

  // ==========================================
  // ARTIST — PARSE DARI AUTHOR FIELD
  // ==========================================
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

  // ==========================================
  // SYNOPSIS — EXPANDED SELECTORS
  // ==========================================
  const synopsisSelectors = [
    '.manga-excerpt',
    '.summary',
    '.synopsis',
    '[itemprop="description"]',
    '.post-content_item:contains("Synopsis") .summary-content',
    '.wd-full:contains("Synopsis")',
    '.entry-content'
  ];

  for (const sel of synopsisSelectors) {
    const el = $(sel).first();
    if (el.length && el.text().trim()) {
      result.synopsis = el.text().trim().substring(0, 1000);
      break;
    }
  }

  // Fallback: cari paragraf terpanjang di .entry-content (biasanya synopsis)
  if (!result.synopsis) {
    let longestText = '';
    $('.entry-content p, .summary p, .manga-excerpt p').each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > longestText.length) longestText = text;
    });
    if (longestText.length > 50) result.synopsis = longestText;
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

  // Fallback chapters
  if (result.chapters.length === 0) {
    $('a[href*="-chapter-"]').each((i, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().trim();
      
      if (!result.chapters.find(ch => ch.chapter_url === href)) {
        result.chapters.push({
          index: i + 1,
          chapter_url: href,
          chapter_number: text,
          release_date: '',
          slug: href.replace(BASE_URL, '').replace(/^\//, '').replace(/\/$/, '')
        });
      }
    });
  }

  // Sort chapters
  result.chapters.sort((a, b) => {
    const numA = parseFloat(a.chapter_number.match(/\d+(\.\d+)?/)?.[0] || 0);
    const numB = parseFloat(b.chapter_number.match(/\d+(\.\d+)?/)?.[0] || 0);
    return numB - numA;
  });
  result.chapters.forEach((ch, i) => ch.index = i + 1);

  return result;
}

export { scrapeDetail };
