// src/scraper/read.js
import axios from 'axios';
import * as cheerio from 'cheerio';

const BASE_URL = 'https://www.manhwaindo.my';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function extractSlug(href) {
  if (!href || href === '#' || href.startsWith('javascript:') || href.startsWith('void')) return null;
  try {
    const url = new URL(href, BASE_URL);
    const match = url.pathname.match(/\/([^/]+)\/?$/);
    if (!match) return null;
    const slug = match[1];
    const blacklist = ['prev', 'next', 'javascript', 'void', ''];
    if (blacklist.includes(slug.toLowerCase())) return null;
    if (!/\d/.test(slug)) return null;
    return slug;
  } catch (e) {
    return null;
  }
}

// Ambil semua chapter dari halaman series
async function getSeriesChapters(seriesSlug) {
  try {
    const url = `${BASE_URL}/series/${seriesSlug}/`;
    const { data: html } = await axios.get(url, {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 30000
    });
    const $ = cheerio.load(html);

    const chapters = [];
    
    // Method 1: chapterlist (Madara theme)
    $('#chapterlist ul li, .eplister ul li, .chapters li, .chapter-list li').each((_, el) => {
      const $el = $(el);
      const link = $el.find('a').first();
      const href = link.attr('href') || '';
      const slug = extractSlug(href);
      if (slug) {
        chapters.push({
          slug,
          number: $el.find('.chapternum, .epl-num, .chapter-num').text().trim() || slug,
          url: href
        });
      }
    });

    // Method 2: fallback semua link yang mengandung "chapter"
    if (chapters.length === 0) {
      $('a[href*="-chapter-"], a[href*="/chapter/"]').each((_, el) => {
        const href = $(el).attr('href') || '';
        const slug = extractSlug(href);
        if (slug && !chapters.find(c => c.slug === slug)) {
          chapters.push({
            slug,
            number: $(el).text().trim() || slug,
            url: href
          });
        }
      });
    }

    // Sort descending (chapter terbaru di atas)
    chapters.sort((a, b) => {
      const numA = parseFloat(a.number.match(/\d+(\.\d+)?/)?.[0] || 0);
      const numB = parseFloat(b.number.match(/\d+(\.\d+)?/)?.[0] || 0);
      return numB - numA;
    });

    return chapters;
  } catch (e) {
    console.error('[getSeriesChapters] Error:', e.message);
    return [];
  }
}

async function scrapeRead(slug) {
  const url = `${BASE_URL}/${slug}/`;

  const { data: html } = await axios.get(url, {
    headers: { 'User-Agent': USER_AGENT },
    timeout: 30000
  });

  const $ = cheerio.load(html);

  const result = {
    title: '',
    chapter_number: '',
    series_title: '',
    series_url: '',
    series_slug: '',
    prev_chapter: null,
    next_chapter: null,
    images: [],
    chapters: [] // ← TAMBAHIN INI
  };

  // Title
  const h1Text = $('h1.entry-title').text().trim();
  const titleText = $('title').text().trim();
  result.title = h1Text || titleText;
  if (result.title.includes(' | ')) {
    result.title = result.title.split(' | ')[0].trim();
  }

  // Chapter number
  const chapMatch = result.title.match(/Chapter\s+(\d+(\.\d+)?)/i);
  if (chapMatch) result.chapter_number = chapMatch[1];

  // Series info
  const seriesEl = $('.allc a, .ts-breadcrumb li:nth-child(2) a, [href*="/series/"]').first();
  if (seriesEl.length) {
    result.series_title = seriesEl.text().trim();
    result.series_url = seriesEl.attr('href') || '';
    const seriesMatch = result.series_url.match(/\/series\/([^/]+)/);
    if (seriesMatch) result.series_slug = seriesMatch[1];
  }

  // ========== AMBIL SEMUA CHAPTER DARI SERIES PAGE ==========
  let allChapters = [];
  if (result.series_slug) {
    allChapters = await getSeriesChapters(result.series_slug);
    result.chapters = allChapters; // ← MASUKIN KE RESPONSE
  }

  // ========== PREV / NEXT dari navigasi halaman ==========
  const navLinks = $('.nextprev a, .chapter-nav a, .nav-links a, a[rel="prev"], a[rel="next"], .prev a, .next a');
  
  navLinks.each((_, el) => {
    const $el = $(el);
    const href = $el.attr('href') || '';
    const rel = $el.attr('rel') || '';
    const className = $el.attr('class') || '';
    const text = $el.text().toLowerCase();
    
    const extractedSlug = extractSlug(href);
    if (!extractedSlug) return;
    
    if (rel === 'prev' || className.includes('prev') || text.includes('prev')) {
      result.prev_chapter = extractedSlug;
    }
    if (rel === 'next' || className.includes('next') || text.includes('next')) {
      result.next_chapter = extractedSlug;
    }
  });

  // ========== FALLBACK: Ambil dari allChapters kalau navigasi gak ketemu ==========
  if ((!result.prev_chapter || !result.next_chapter) && allChapters.length > 0) {
    const currentIndex = allChapters.findIndex(ch => ch.slug === slug);
    
    if (currentIndex !== -1) {
      if (!result.prev_chapter && currentIndex < allChapters.length - 1) {
        result.prev_chapter = allChapters[currentIndex + 1].slug; // +1 karena descending
      }
      if (!result.next_chapter && currentIndex > 0) {
        result.next_chapter = allChapters[currentIndex - 1].slug; // -1 karena descending
      }
    }
  }

  // ========== CARI GAMBAR ==========
  const readerSelectors = [
    '#readerarea', '.readerarea', '.chapter-images', 
    '.img-content', '.entry-content', 'article', '#content'
  ];

  let imagesFound = false;

  for (const selector of readerSelectors) {
    const reader = $(selector).first();
    if (!reader.length) continue;

    const imgs = reader.find('img');
    if (!imgs.length) continue;

    imgs.each((_, el) => {
      let imgUrl = $(el).attr('data-src') || $(el).attr('src') || $(el).attr('data-lazy-src');
      
      if (!imgUrl) {
        const style = $(el).attr('style') || '';
        const bgMatch = style.match(/background-image:\s*url\(['"]?([^'")]+)['"]?\)/);
        if (bgMatch) imgUrl = bgMatch[1];
      }

      if (!imgUrl) return;
      imgUrl = imgUrl.trim();

      // Filter sampah
      if (
        imgUrl.includes('data:image') || imgUrl.includes('base64') ||
        imgUrl.includes('logo') || imgUrl.includes('thumbnail') ||
        imgUrl.endsWith('.gif') || imgUrl.includes('banner') ||
        imgUrl.includes('koko88') || imgUrl.includes('mizu') ||
        imgUrl.includes('placeholder') || imgUrl.includes('blank')
      ) return;

      result.images.push({
        index: result.images.length + 1,
        url: imgUrl,
        alt: $(el).attr('alt') || $(el).attr('title') || ''
      });
      imagesFound = true;
    });

    if (imagesFound) break;
  }

  // Fallback
  if (result.images.length === 0) {
    $('img').each((_, el) => {
      let imgUrl = $(el).attr('data-src') || $(el).attr('src');
      if (!imgUrl) return;
      if (imgUrl.includes('wp-content') || imgUrl.includes('uploads') || imgUrl.includes('cdn')) {
        if (!imgUrl.includes('logo') && !imgUrl.includes('icon')) {
          result.images.push({
            index: result.images.length + 1,
            url: imgUrl,
            alt: $(el).attr('alt') || $(el).attr('title') || ''
          });
        }
      }
    });
  }

  // Re-index
  result.images.forEach((img, i) => img.index = i + 1);

  return result;
}

export { scrapeRead };
