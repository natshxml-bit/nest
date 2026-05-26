// src/scraper/detail.js
const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://www.manhwaindo.my';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function scrapeDetail(slug) {
  const url = `${BASE_URL}/series/${slug}/`;
  
  const { data: html } = await axios.get(url, {
    headers: { 'User-Agent': USER_AGENT },
    timeout: 30000
  });
  
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

  // ========== META INFO FIX ==========
  // Coba berbagai struktur HTML yang umum di theme manga WP
  
  // Method 1: .tsinfo .imptdt (Madara theme)
  $('.tsinfo .imptdt, .info-right .imptdt').each((_, el) => {
    const $el = $(el);
    const label = $el.contents().filter(function() {
      return this.nodeType === 3; // text node
    }).text().trim().toLowerCase();
    
    const value = $el.find('a, span, i').last().text().trim();
    
    if (label.includes('status')) result.status = value;
    if (label.includes('type')) result.type = value;
    if (label.includes('author')) result.author = value;
    if (label.includes('artist')) result.artist = value;
  });

  // Method 2: .fmed (MangaStream theme)
  if (!result.status || !result.type) {
    $('.fmed, .flex-wrap').each((_, el) => {
      const $el = $(el);
      const label = $el.find('b, .label, strong').first().text().trim().toLowerCase();
      const value = $el.find('span, a').last().text().trim();
      
      if (label.includes('status') && !result.status) result.status = value;
      if (label.includes('type') && !result.type) result.type = value;
      if (label.includes('author') && !result.author) result.author = value;
      if (label.includes('artist') && !result.artist) result.artist = value;
    });
  }

  // Method 3: table / list structure
  if (!result.status || !result.type) {
    $('table tr, dl dt, .info-content li').each((_, el) => {
      const $el = $(el);
      const text = $el.text().toLowerCase();
      const value = $el.next().text().trim() || $el.find('+ dd').text().trim() || $el.find('td:last-child, span:last-child').text().trim();
      
      if (text.includes('status') && !result.status) result.status = value;
      if (text.includes('type') && !result.type) result.type = value;
      if (text.includes('author') && !result.author) result.author = value;
      if (text.includes('artist') && !result.artist) result.artist = value;
    });
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
  result.synopsis = $('.entry-content p, .summary p, .synopsis p, .wd-full:contains("Synopsis") + div p, [itemprop="description"] p').first().text().trim();

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

module.exports = { scrapeDetail };
