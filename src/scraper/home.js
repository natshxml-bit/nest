const axios = require('axios');
const cheerio = require('cheerio');
const { BASE_URL } = require('../../config/settings');

// 🔥 FIX ANTI-403: Jurus Nyamar Tingkat Dewa Buat Vercel
const http = axios.create({
  timeout: 15000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'sec-ch-ua': '"Google Chrome";v="123", "Not:A-Brand";v="8", "Chromium";v="123"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'document',
    'sec-fetch-mode': 'navigate',
    'sec-fetch-site': 'none',
    'sec-fetch-user': '?1',
    'upgrade-insecure-requests': '1',
    'Cache-Control': 'max-age=0',
    'Connection': 'keep-alive',
    'Referer': 'https://www.google.com/' // Pura-pura dateng dari Google
  }
});

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
    const { data: html } = await http.get(url, { timeout: 10000 }); // Naikin timeout dikit buat Vercel
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
  // Tangkep error 403 di sini biar nggak bikin crash se-server
  let html;
  try {
    const response = await http.get(BASE_URL);
    html = response.data;
  } catch (error) {
    console.error(`[HOME ERROR] Gagal ngambil data dari ${BASE_URL}. Error:`, error.message);
    throw new Error('Gagal ngelewatin blokiran keamanan web (403)');
  }
  
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
          needsFallback: !rating // flag kalau rating kosong
        });
      }
    });
  });

  // ─── Parallel fetch: sinopsis + rating fallback ───
  const detailPromises = result.popular_today.map(async (item) => {
    const detail = await getDetailData(item.slug);
    item.synopsis = detail.synopsis;
    if (item.needsFallback) {
      item.rating = detail.rating;
    }
    delete item.needsFallback;
  });

  // Kalau di Vercel, jangan barbar nembak parallel banyak-banyak, kita kasih limit 5 aja biar nggak keciduk DDOS
  const limit = (await import('p-limit')).default(5);
  await Promise.all(result.popular_today.map(item => limit(async () => {
      const detail = await getDetailData(item.slug);
      item.synopsis = detail.synopsis;
      if (item.needsFallback) item.rating = detail.rating;
      delete item.needsFallback;
  })));


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

module.exports = { scrapeHome };
