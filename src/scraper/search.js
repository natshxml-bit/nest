// src/scraper/search.js
import axios from 'axios';
import * as cheerio from 'cheerio';

const BASE_URL = 'https://www.manhwaindo.my';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function scrapeDetailRating(slug) {
  try {
    const url = `${BASE_URL}/${slug}`;
    const { data: html } = await axios.get(url, {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 10000
    });
    const $ = cheerio.load(html);
    const rating = $('.rating-value, .score, [class*="rating"], .numscore').first().text().trim();
    return rating || 'N/A';
  } catch (err) {
    return 'N/A';
  }
}

// Helper: concurrency limit tanpa dependency
async function withConcurrency(tasks, limit) {
  let index = 0;
  async function worker() {
    while (index < tasks.length) {
      const i = index++;
      await tasks[i]();
    }
  }
  await Promise.all(Array(Math.min(limit, tasks.length)).fill().map(worker));
}

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

    let thumb = '';
    const img = item.find('img');
    thumb = img.attr('data-src') || 
            img.attr('data-lazy-src') || 
            img.attr('data-original') ||
            img.attr('src') || '';

    if (!thumb || thumb.startsWith('data:')) {
      const noscript = item.find('noscript').html();
      if (noscript) {
        const match = noscript.match(/src=["'](https?:\/\/[^"']+)["']/i);
        if (match) thumb = match[1];
      }
    }

    if (!thumb || thumb.startsWith('data:') || thumb.includes('svg')) {
      thumb = 'https://via.placeholder.com/200x300?text=No+Image';
    }

    if (title && link) {
      const slug = link.replace(BASE_URL, '').replace(/^\//, '').replace(/\/$/, '');
      results.push({ title, slug, thumb, chapter: chapter || 'N/A', rating: 'N/A' });
    }
  });

  // Scrape rating parallel, max 5 concurrent
  if (results.length > 0) {
    const tasks = results.map(item => () =>
      scrapeDetailRating(item.slug).then(rating => {
        item.rating = rating;
      })
    );
    await withConcurrency(tasks, 5);
  }

  return results;
}

export { scrapeSearch, scrapeDetailRating };
