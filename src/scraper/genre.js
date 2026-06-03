// src/scraper/genre.js
import { axiosNinja, cachedScrape, cacheKey } from '../utils.js'; // 🔥 Tambahin Cache Tools
import * as cheerio from 'cheerio';

function fixImageUrl(url) {
  if (!url) return '';
  if (!url.startsWith('http')) {
    return 'https://www.manhwaindo.my' + (url.startsWith('/') ? '' : '/') + url;
  }
  return url;
}

// Extract clean slug from URL pathname
function extractSlugFromUrl(url, fallbackPatterns = []) {
  try {
    const pathname = new URL(url, 'https://www.manhwaindo.my').pathname; // handle relative URLs too
    const parts = pathname.split('/').filter(Boolean);
    // Return last meaningful segment
    if (parts.length > 0) return parts[parts.length - 1];
  } catch (e) {
    // fallback to regex if URL invalid
  }
  // legacy fallback
  let slug = url;
  for (const pat of fallbackPatterns) {
    slug = slug.replace(pat, '');
  }
  return slug.replace(/\/$/, '');
}

// === LIST SEMUA GENRE (HARDCODED) ===
// Ini nggak usah di-cache karena udah instan dari sananya
async function scrapeGenres() {
  return [
    { name: "4-Koma", slug: "4-koma" },
    { name: "Action", slug: "action" },
    { name: "Adult", slug: "adult" },
    { name: "Adventure", slug: "adventure" },
    { name: "Boys' Love", slug: "boys-love" },
    { name: "Comedy", slug: "comedy" },
    { name: "Cooking", slug: "cooking" },
    { name: "Crime", slug: "crime" },
    { name: "Crossdressing", slug: "crossdressing" },
    { name: "Demons", slug: "demons" },
    { name: "Drama", slug: "drama" },
    { name: "Ecchi", slug: "ecchi" },
    { name: "Emperor's Daughter", slug: "emperors-daughter" },
    { name: "Entertainment", slug: "entertainment" },
    { name: "Fantasy", slug: "fantasy" },
    { name: "Game", slug: "game" },
    { name: "Gender Bender", slug: "gender-bender" },
    { name: "Gore", slug: "gore" },
    { name: "Harem", slug: "harem" },
    { name: "Historical", slug: "historical" },
    { name: "Horror", slug: "horror" },
    { name: "Isekai", slug: "isekai" },
    { name: "Josei", slug: "josei" },
    { name: "Magic", slug: "magic" },
    { name: "Martial Arts", slug: "martial-arts" },
    { name: "Mature", slug: "mature" },
    { name: "Mecha", slug: "mecha" },
    { name: "Medical", slug: "medical" },
    { name: "Military", slug: "military" },
    { name: "Monster Girls", slug: "monster-girls" },
    { name: "Music", slug: "music" },
    { name: "Mystery", slug: "mystery" },
    { name: "Psychological", slug: "psychological" },
    { name: "Reincarnation", slug: "reincarnation" },
    { name: "Reverse Harem", slug: "reverse-harem" },
    { name: "Romance", slug: "romance" },
    { name: "School", slug: "school" },
    { name: "School Life", slug: "school-life" },
    { name: "Sci-Fi", slug: "sci-fi" },
    { name: "Seinen", slug: "seinen" },
    { name: "Shoujo", slug: "shoujo" },
    { name: "Shoujo Ai", slug: "shoujo-ai" },
    { name: "Shounen", slug: "shounen" },
    { name: "Shounen Ai", slug: "shounen-ai" },
    { name: "Slice of Life", slug: "slice-of-life" },
    { name: "Smut", slug: "smut" },
    { name: "Sports", slug: "sports" },
    { name: "Super Power", slug: "super-power" },
    { name: "Supernatural", slug: "supernatural" },
    { name: "Survival", slug: "survival" },
    { name: "Thriller", slug: "thriller" },
    { name: "Tragedy", slug: "tragedy" },
    { name: "Vampire", slug: "vampire" },
    { name: "Webtoons", slug: "webtoons" },
    { name: "Yaoi", slug: "yaoi" },
    { name: "Yuri", slug: "yuri" },
    { name: "Zombies", slug: "zombies" }
  ];
}


// ─── KODINGAN MURNI SCRAPER ───
async function rawScrapeByGenre(genreSlug, pageNum = 1) {
  try {
    const base = `https://www.manhwaindo.my/genres/${genreSlug}`;
    const url = pageNum === 1 ? `${base}/` : `${base}/page/${pageNum}/`;

    const { data: html } = await axiosNinja.get(url, { timeout: 30000 });
    
    const $ = cheerio.load(html);
    const results = [];

    $('.uta, .bsx, .page-item-detail, .listupd .bsx').each((_, item) => {
      const el = $(item);
      
      const imgEl = el.find('img').first();
      let cover =
        imgEl.attr('data-src') ||
        imgEl.attr('data-lazy-src') ||
        imgEl.attr('src') ||
        imgEl.attr('data-original') ||
        '';

      if (!cover) {
        const style = imgEl.attr('style') || '';
        const bgMatch = style.match(/background-image:\s*url\(['"]?([^'")]+)['"]?\)/);
        if (bgMatch) cover = bgMatch[1];
      }
      cover = fixImageUrl(cover);

      let linkEl = el.find('a[title]').first();
      if (!linkEl.length) linkEl = el.find('.tt a, a.tt, h2 a, h3 a, h4 a').first();
      if (!linkEl.length) linkEl = el.find('a').first();

      const title = linkEl.attr('title') || linkEl.text().trim();
      const link = linkEl.attr('href') || '';
      
      const slug = extractSlugFromUrl(link, [/.*\/project\//, /.*\/manga\//, /.*\/manhwa\//]);

      const typeEl = el.find('.type, .typez, [class*="type"]').first();
      const type = (typeEl.text() || 'MANHWA').trim().toUpperCase();

      const chapterEl = el.find('.epxs, .chapter, [class*="chapter"]').first();
      const latest_chapter = chapterEl.text().trim();

      const timeEl = el.find('.time, [class*="time"], [class*="ago"]').first();
      const time = timeEl.text().trim();

      if (title) {
        results.push({
          title,
          slug,
          thumb: cover || 'https://placehold.co/300x400/1a1a1a/666?text=No+Image',
          type,
          latest_chapter,
          time,
          link
        });
      }
    });

    const nextEl = $('.pagination a.next, a[rel="next"], .pagination .next');
    const hasNext = nextEl.length > 0 && !nextEl.hasClass('disabled') && nextEl.attr('href') !== undefined;
    
    let currentPage = pageNum;
    const currentEl = $('.pagination .current, .pagination .active').first();
    if (currentEl.length) {
      const txt = currentEl.text().trim();
      if (/^\d+$/.test(txt)) currentPage = parseInt(txt);
    }

    return {
      results,
      pagination: {
        current: currentPage,
        has_next: hasNext,
      },
    };
  } catch (error) {
    console.error('[SCRAPE] Error byGenre:', error.message);
    throw error;
  }
}

// ─── 🔥 FUNGSI UTAMA (CACHE WRAPPER) ───
async function scrapeByGenre(genreSlug, pageNum = 1) {
  const start = Date.now();
  // Key dibikin unik per genre dan halamannya, misal: manga:genre:action:1
  const KEY = cacheKey('manga', 'genre', genreSlug, pageNum);
  const TTL = 60 * 10; // ⏱️ Cache 10 menit

  // Panggil wrapper cachedScrape
  const { data, cached } = await cachedScrape(KEY, TTL, () => rawScrapeByGenre(genreSlug, pageNum));

  console.log(`[GENRE] ${genreSlug} Page ${pageNum} DONE in ${Date.now() - start}ms | Cached: ${cached}`);
  return data;
}

export { scrapeGenres, scrapeByGenre };
