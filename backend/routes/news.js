const express = require('express');
const router = express.Router();
const Parser = require('rss-parser');

let yahooFinance = null;
try {
  const mod = require('yahoo-finance2');
  const Ctor = mod.YahooFinance || (typeof mod.default === 'function' ? mod.default : null) || (typeof mod === 'function' ? mod : null);
  if (Ctor) yahooFinance = new Ctor({ suppressNotices: ['yahooSurvey'] });
  else console.warn('yahoo-finance2: unexpected export shape', Object.keys(mod));
} catch (e) { console.warn('yahoo-finance2 init failed:', e.message); }

const parser = new Parser({ timeout: 8000 });

const REUTERS_FEEDS = [
  'https://feeds.reuters.com/reuters/businessNews',
  'https://feeds.reuters.com/reuters/topNews',
];

const BLOOMBERG_FEEDS = [
  'https://feeds.bloomberg.com/markets/news.rss',
  'https://feeds.bloomberg.com/technology/news.rss',
];

async function fetchRSSFeed(urls, source) {
  const results = await Promise.allSettled(urls.map(url => parser.parseURL(url)));
  const seen = new Set();
  const articles = [];
  results.forEach(r => {
    if (r.status !== 'fulfilled') return;
    r.value.items.forEach(item => {
      if (!item.link || seen.has(item.link)) return;
      seen.add(item.link);
      articles.push({
        headline: item.title,
        summary: item.contentSnippet || '',
        source,
        url: item.link,
        created_at: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
        symbols: [],
      });
    });
  });
  return articles;
}

async function fetchYahooNews() {
  if (!yahooFinance) { console.warn('fetchYahooNews: yahooFinance is null'); return []; }
  try {
    const queries = ['stock market today', 'S&P 500', 'investing economy'];
    const results = await Promise.allSettled(
      queries.map(q => yahooFinance.search(q, { newsCount: 8, quotesCount: 0 }))
    );
    const seen = new Set();
    const articles = [];
    results.forEach(r => {
      if (r.status !== 'fulfilled' || !r.value.news) return;
      r.value.news.forEach(item => {
        if (!item.link || seen.has(item.link)) return;
        seen.add(item.link);
        let created_at;
        try {
          const ts = item.providerPublishTime;
          if (ts instanceof Date) created_at = ts.toISOString();
          else if (typeof ts === 'number') created_at = new Date(ts * 1000).toISOString();
          else created_at = new Date().toISOString();
        } catch { created_at = new Date().toISOString(); }
        articles.push({
          headline: item.title,
          summary: '',
          source: item.publisher || 'Yahoo Finance',
          url: item.link,
          created_at,
          symbols: item.relatedTickers || [],
        });
      });
    });
    return articles;
  } catch (err) {
    console.error('Yahoo Finance news error:', err.message);
    return [];
  }
}

function interleave(arrays) {
  const result = [];
  const maxLen = Math.max(...arrays.map(a => a.length), 0);
  for (let i = 0; i < maxLen; i++) {
    arrays.forEach(arr => { if (i < arr.length) result.push(arr[i]); });
  }
  return result;
}

router.get('/', async (req, res) => {
  const { tickers } = req.query;
  try {
    const [reutersRes, bloombergRes, yahooRes] = await Promise.allSettled([
      fetchRSSFeed(REUTERS_FEEDS, 'Reuters'),
      fetchRSSFeed(BLOOMBERG_FEEDS, 'Bloomberg'),
      fetchYahooNews(),
    ]);

    const dedup = (arr) => {
      const seen = new Set();
      return arr.filter(a => { if (seen.has(a.url)) return false; seen.add(a.url); return true; });
    };

    // Sort each source independently newest-first, cap at 20 each
    const reuters   = dedup(reutersRes.status   === 'fulfilled' ? reutersRes.value   : []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 20);
    const bloomberg = dedup(bloombergRes.status === 'fulfilled' ? bloombergRes.value : []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 20);
    const yahoo     = dedup(yahooRes.status     === 'fulfilled' ? yahooRes.value     : []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 20);

    console.log(`News sources: Reuters: ${reuters.length}, Bloomberg: ${bloomberg.length}, Yahoo: ${yahoo.length}`);

    // Round-robin so no single source dominates
    let articles = interleave([reuters, bloomberg, yahoo]).slice(0, 60);

    if (tickers) {
      const terms = tickers.toUpperCase().split(',').map(t => t.trim());
      const filtered = articles.filter(a =>
        terms.some(t =>
          a.headline.toUpperCase().includes(t) ||
          (a.summary || '').toUpperCase().includes(t) ||
          (a.symbols || []).includes(t)
        )
      );
      if (filtered.length) articles = filtered;
    }

    res.json({ articles });
  } catch (err) {
    console.error('News error:', err.message);
    res.json({ articles: [] });
  }
});

module.exports = router;
