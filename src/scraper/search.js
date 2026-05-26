// src/scraper/search.js
const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://www.manhwaindo.my';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function scrapeSearch(keyword) {
  const url = `${BASE_URL}/?s=${encodeURIComponent(keyword)}`;
  
  const { data: html } = await axios.get(url, {
    headers: { 'User-Agent': USER_AGENT },
    timeout: 30000
  });

  const $ = cheerio.load(html);
  const results = [];

  $('.bsx, .listupd .bsx, .search-result .bsx').each((i, el) => {
    const item = $(el);
    
    const linkEl = item.find('a').first();
    const title = linkEl.attr('title') || linkEl.text().trim();
    const link = linkEl.attr('href') || '';
    
    const chapter = item.find('.epxs, .epx, .latest-chap').text().trim();

    // Cari thumb
    let thumb = '';
    const img = item.find('img');
    
    // Priority: data-src > data-lazy-src > src
    thumb = img.attr('data-src') || 
            img.attr('data-lazy-src') || 
            img.attr('data-original') ||
            img.attr('src') || '';

    // Kalau masih kosong, cek noscript fallback
    if (!thumb || thumb.startsWith('data:')) {
      const noscript = item.find('noscript').html();
      if (noscript) {
        const match = noscript.match(/src=["'](https?:\/\/[^"']+)["']/i);
        if (match) thumb = match[1];
      }
    }

    // Fallback image
    if (!thumb || thumb.startsWith('data:') || thumb.includes('svg')) {
      thumb = 'https://via.placeholder.com/200x300?text=No+Image';
    }

    if (title && link) {
      results.push({
        title,
        slug: link.replace(BASE_URL, '').replace(/^\//, '').replace(/\/$/, ''),
        thumb,
        chapter: chapter || 'N/A'
      });
    }
  });

  return results;
}

module.exports = { scrapeSearch };
