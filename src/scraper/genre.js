// src/scraper/genre.js
import * as cheerio from 'cheerio';
import { axiosNinja, cachedScrape, cacheKey } from '../utils.js';

const BASE_URL = 'https://www.manhwaindo.my';

async function rawScrapeGenreList() {
  const url = `${BASE_URL}/series/`;
  const { data: html } = await axiosNinja.get(url, { timeout: 15000 });
  const $ = cheerio.load(html);
  
  const genres = [];
  
  // Nyari menu dropdown genre sesuai HTML yang lu kirim sebelumnya
  $('.filter.dropdown ul.genrez li').each((_, el) => {
    const inputEl = $(el).find('input');
    const labelEl = $(el).find('label');
    
    const id = inputEl.val();
    const name = labelEl.text().trim();
    
    // Pastiin ID-nya dapet dan namanya bukan label kosong
    if (id && name) {
      genres.push({
        id: parseInt(id),
        name: name
      });
    }
  });
  
  return genres;
}

async function scrapeGenreList() {
  const KEY = cacheKey('manga', 'genrelist');
  const TTL = 60 * 60 * 24 * 7; // ⏱️ Cache 1 minggu (karena genre jarang banget nambah/berubah)

  const { data, cached } = await cachedScrape(KEY, TTL, rawScrapeGenreList);
  console.log(`[GENRE LIST] DONE | Cached: ${cached}`);
  return data;
}

export { scrapeGenreList };
