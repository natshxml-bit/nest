export default function handler(req, res) {
  res.status(200).json({
    message: 'ManhwaIndo Scraper API',
    endpoints: {
      home: '/home',
      updates: '/updates?page=1',
      popular: '/popular?page=1',
      latest: '/latest?page=1',
      search: '/search?q=keyword',
      genres: '/genres',
      genre: '/genre/:slug?page=1',
      detail: '/detail/:slug',
      read: '/read/:slug',
      filter: '/filter?status=ongoing&type=manhwa&order=popular&page=1'
    },
    note: 'Add ?refresh=1 to force scrape'
  });
}
