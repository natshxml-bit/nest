import axios from 'axios';
import * as cheerio from 'cheerio';

const BASE_URL = 'https://www.manhwaindo.my';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

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

// ─── Fetch detail page buat rating + sinopsis ───
async function getDetailData(slug) {
  try {
    const url = `${BASE_URL}/series/${slug}/`;
    const { data: html } = await axios.get(url, {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 10000
    });
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
    return { rating: '0', synopsis: '' };
  }
}

async function scrapeHome() {
  const start = Date.now();
  
  const { data: html } = await axios.get(BASE_URL, {
    headers: { 'User-Agent': USER_AGENT },
    timeout: 30000
  });
  
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

  // ─── Sequential fetch detail (biar nggak keciduk) ───
  for (const item of result.popular_today) {
    if (item.needsFallback || !item.synopsis) {
      const detail = await getDetailData(item.slug);
      item.synopsis = detail.synopsis;
      if (item.needsFallback) item.rating = detail.rating;
      delete item.needsFallback;
    }
  }

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
      const latestCh = chapters[0]?.chapter_title || '';

      result.latest_update.push({
        title: seriesLink.find('h4').text().trim(),
        slug: extractSlug(href),
        thumb: getImageSrc($, $item.find('.imgu').length ? $item.find('.imgu')[0] : item),
        type: 'Manhwa',
        latest_chapter: latestCh,
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
      const latestCh = chapters[0]?.chapter_title || '';

      result.project_update.push({
        title: seriesLink.find('h4').text().trim(),
        slug: extractSlug(href),
        thumb: getImageSrc($, $item.find('.imgu').length ? $item.find('.imgu')[0] : item),
        type: 'Manhwa',
        latest_chapter: latestCh,
        link: href,
        chapters
      });
    });
  });

  console.log(`[HOME] DONE in ${Date.now() - start}ms`);
  return result;
}

export { scrapeHome };
