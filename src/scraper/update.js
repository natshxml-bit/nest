// src/scraper/update.js
const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://www.manhwaindo.my';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function scrapeUpdates(page = 1) {
  const url = page === 1 
    ? `${BASE_URL}/project-updates/` 
    : `${BASE_URL}/project-updates/page/${page}/`;

  const { data: html } = await axios.get(url, {
    headers: { 'User-Agent': USER_AGENT },
    timeout: 30000
  });

  const $ = cheerio.load(html);
  const results = [];

  $('.uta, .bsx, .page-item-detail, .listupd .bsx, .item-thumb').each((_, el) => {
    const item = $(el);
    
    // Image
    const img = item.find('img');
    let thumb = img.attr('data-src') || 
                img.attr('data-lazy-src') || 
                img.attr('src') || '';
    
    // Fallback noscript
    if (!thumb || thumb.startsWith('data:')) {
      const noscript = item.find('noscript').html();
      if (noscript) {
        const match = noscript.match(/src=["'](https?:\/\/[^"']+)["']/i);
        if (match) thumb = match[1];
      }
    }

    // Title & link
    const linkEl = item.find('a').first();
    const title = linkEl.attr('title') || linkEl.text().trim();
    const link = linkEl.attr('href') || '';

    // Slug bersih
    const slug = link
      .replace(BASE_URL, '')
      .replace(/^\//, '')
      .replace(/\/$/, '');

    // Type badge
    const type = item.find('.type, .typez, .typename, .limit').first().text().trim().toUpperCase() || 'MANHWA';

    // Chapter
    const chapterEl = item.find('.epxs, .epx, .chapter, [class*="chapter"]').first();
    const chapterText = chapterEl.text().trim();
    const chapterMatch = chapterText.match(/Chapter\s*(\d+(\.\d+)?)/i);
    const chapter = chapterMatch ? `Chapter ${chapterMatch[1]}` : chapterText || 'N/A';

    // Time/Date
    const time = item.find('.time, .date, [class*="time"], [class*="ago"]').first().text().trim();

    // Badges
    const isColor = item.find('.colored, .colx, [class*="color"]').length > 0;
    const isHot = item.find('.hotx, .hot, [class*="hot"]').length > 0;

    if (title && thumb) {
      results.push({
        title,
        slug,
        thumb,
        type,
        chapter,
        time: time || '',
        badges: [
          ...(isColor ? ['color'] : []),
          ...(isHot ? ['hot'] : [])
        ],
        link
      });
    }
  });

  // Pagination
  const pageNav = $('.pagination');
  const currentPage = parseInt(pageNav.find('.current').text().trim()) || page;
  
  let totalPages = currentPage;
  pageNav.find('a.page-numbers, span.page-numbers').each((_, el) => {
    const num = parseInt($(el).text().trim());
    if (!isNaN(num) && num > totalPages) totalPages = num;
  });

  const hasNext = pageNav.find('.next').length > 0 || 
                  pageNav.find('a[rel="next"]').length > 0 ||
                  currentPage < totalPages;

  return {
    results,
    pagination: {
      current: currentPage,
      next_page: hasNext ? currentPage + 1 : null,
      total: totalPages,
      has_next: hasNext,
      next_url: hasNext ? `/api/updates?page=${currentPage + 1}` : null
    }
  };
}

module.exports = { scrapeUpdates };
