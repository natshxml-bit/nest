import axios from 'axios';
import cheerio from 'cheerio';

const BASE_URL = 'https://www.manhwaindo.my';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export async function scrapePopular(page = 1) {
  const url = `${BASE_URL}/series/?order=popular&page=${page}`;
  
  const { data: html } = await axios.get(url, {
    headers: { 'User-Agent': USER_AGENT },
    timeout: 30000
  });

  const $ = cheerio.load(html);
  const results = [];

  $('.bsx, .listupd .bsx, .uta, .page-item').each((i, el) => {
    const item = $(el);
    
    const linkEl = item.find('a').first();
    const title = item.find('.tt').text().trim() || linkEl.attr('title') || linkEl.text().trim();
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

    const type = item.find('.typename, .type').text().trim();
    const rating = item.find('.numscore, .rating .num').text().trim();
    const isHot = item.find('.hotx, .hot').length > 0;
    const isColor = item.find('.colx, .color').length > 0;

    if (title && link) {
      let slug = link.replace(BASE_URL, '').replace(/^\//, '').replace(/\/$/, '');
      slug = slug.replace(/^series\//, '');

      results.push({
        title,
        slug,
        thumb,
        chapter: chapter || 'N/A',
        type: type || 'Unknown',
        rating: rating ? parseFloat(rating) || 0 : 0,
        badges: [
          ...(isHot ? ['hot'] : []),
          ...(isColor ? ['color'] : [])
        ]
      });
    }
  });

  const pageNav = $('.pagination');
  const currentPage = parseInt(pageNav.find('.current').text().trim()) || page;
  
  let totalPages = currentPage;
  pageNav.find('a.page-numbers, span.page-numbers').each((i, el) => {
    const num = parseInt($(el).text().trim());
    if (!isNaN(num) && num > totalPages) totalPages = num;
  });

  const hasNext = pageNav.find('.next').length > 0 || 
                  pageNav.find('a[href*="page="]').length > 0 ||
                  currentPage < totalPages;

  return {
    results,
    pagination: {
      current: currentPage,
      next_page: hasNext ? currentPage + 1 : null,
      total: totalPages,
      has_next: hasNext,
      next_url: hasNext ? `/api/popular?page=${currentPage + 1}` : null
    }
  };
}
