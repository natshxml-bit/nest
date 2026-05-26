const axios = require('axios');
const cheerio = require('cheerio');
const { BASE_URL } = require('../../config/settings');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const http = axios.create({
  timeout: 10000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 14; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
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

async function scrapeHome() {
  const start = Date.now();
  const { data: html } = await http.get(BASE_URL);
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
        result.popular_today.push({
          title,
          slug: extractSlug(href),
          thumb: getImageSrc($, item),
          type: $item.find('.typename').text().trim() || 'Manhwa',
          latest_chapter: $item.find('.epxs').text().trim(),
          rating: $item.find('.numscore').text().trim(),
          link: href,
          is_colored: $item.find('.colored').length > 0,
          is_hot: $item.find('.hotx').length > 0
        });
      }
    });
  });

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
        chapters // tetep ada buat detail
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

  console.log(`[HOME] DONE in ${Date.now() - start}ms — Popular: ${result.popular_today.length}, Latest: ${result.latest_update.length}, Project: ${result.project_update.length}`);
  return result;
}

module.exports = { scrapeHome };
