const express = require('express');
const router = express.Router();
const axios = require('axios');

let yahooFinance = null;
try {
  const YahooFinance = require('yahoo-finance2').default;
  yahooFinance = new YahooFinance({
    suppressNotices: ['yahooSurvey', 'ripHistorical'],
    validation: { logErrors: false },
  });
} catch (e) { console.warn('yahoo-finance2 init failed:', e.message); }

const CACHE = { FG: 15 * 60 * 1000, TICKERS: 2 * 60 * 1000, CHART: 10 * 60 * 1000, YIELD: 60 * 60 * 1000 };
let fgCache         = { data: null, ts: 0 };
let tickersCache    = { data: null, ts: 0 };
let yieldCurveCache = { data: null, ts: 0 };
const chartCache    = {};
const screenerCache = {};
const quotesCache   = {};

const YIELD_SYMBOLS = ['^IRX', '^FVX', '^TNX', '^TYX'];
const YIELD_META    = { '^IRX': { label: '3M', years: 0.25 }, '^FVX': { label: '5Y', years: 5 }, '^TNX': { label: '10Y', years: 10 }, '^TYX': { label: '30Y', years: 30 } };

const INDEX_NAMES = { '^GSPC': 'S&P 500', '^DJI': 'Dow 30', '^IXIC': 'Nasdaq', '^RUT': 'Russell 2K' };

// ── Fear & Greed ──────────────────────────────────────────────────────────────
router.get('/fear-greed', async (req, res) => {
  if (fgCache.data && Date.now() - fgCache.ts < CACHE.FG) return res.json(fgCache.data);
  try {
    const r = await axios.get('https://production.dataviz.cnn.io/index/fearandgreed/graphdata', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 8000,
    });
    const fg = r.data.fear_and_greed;
    const result = { score: Math.round(fg.score), rating: fg.rating, timestamp: fg.timestamp };
    fgCache = { data: result, ts: Date.now() };
    res.json(result);
  } catch (err) {
    console.error('Fear & Greed error:', err.message);
    if (fgCache.data) return res.json(fgCache.data);
    res.status(502).json({ error: 'Could not fetch Fear & Greed data' });
  }
});

// ── Market tickers: indices + most active ─────────────────────────────────────
router.get('/tickers', async (req, res) => {
  if (tickersCache.data && Date.now() - tickersCache.ts < CACHE.TICKERS) return res.json(tickersCache.data);
  if (!yahooFinance) return res.json({ indices: [], active: [] });
  try {
    const INDICES = ['^GSPC', '^DJI', '^IXIC', '^RUT'];
    const [indexRes, activeRes] = await Promise.allSettled([
      Promise.allSettled(INDICES.map(s => yahooFinance.quote(s))),
      yahooFinance.quote(SCREENER_TICKERS.slice(0, 12)),
    ]);

    const mapQuote = q => ({
      symbol: q.symbol,
      name: INDEX_NAMES[q.symbol] || q.shortName || q.symbol,
      price: q.regularMarketPrice,
      change: q.regularMarketChange,
      changePct: q.regularMarketChangePercent,
    });

    const indices = indexRes.status === 'fulfilled'
      ? indexRes.value.map((r, i) => r.status === 'fulfilled' ? mapQuote(r.value) : null).filter(Boolean)
      : [];

    const activeRaw = activeRes.status === 'fulfilled' ? (Array.isArray(activeRes.value) ? activeRes.value : [activeRes.value]) : [];
    const active = activeRaw.filter(Boolean).map(mapQuote);

    const result = { indices, active };
    console.log(`Tickers: ${indices.length} indices, ${active.length} active stocks`);
    tickersCache = { data: result, ts: Date.now() };
    res.json(result);
  } catch (err) {
    console.error('Tickers error:', err.message);
    if (tickersCache.data) return res.json(tickersCache.data);
    res.json({ indices: [], active: [] });
  }
});

// ── Screener: most active / gainers / losers (quote-based, screener API broken) ─
const SCREENER_TICKERS = ['AAPL','MSFT','NVDA','AMZN','GOOGL','TSLA','META','AMD','PLTR','MARA','SMCI','AVGO','NFLX','BABA','INTC','BAC','F','AAL','RIVN','NIO'];

router.get('/screener', async (req, res) => {
  const VALID = ['most_actives', 'day_gainers', 'day_losers'];
  const type  = VALID.includes(req.query.type) ? req.query.type : 'most_actives';
  if (screenerCache[type] && Date.now() - screenerCache[type].ts < CACHE.TICKERS) return res.json(screenerCache[type].data);
  if (!yahooFinance) return res.json({ quotes: [] });
  try {
    const mapQ = q => ({
      symbol: q.symbol,
      name: q.shortName || q.symbol,
      price: q.regularMarketPrice,
      change: q.regularMarketChange,
      changePct: q.regularMarketChangePercent,
    });
    const results = await yahooFinance.quote(SCREENER_TICKERS);
    const all = (Array.isArray(results) ? results : [results]).filter(Boolean).map(mapQ);
    let quotes;
    if (type === 'day_gainers') quotes = [...all].sort((a, b) => (b.changePct || 0) - (a.changePct || 0)).slice(0, 12);
    else if (type === 'day_losers') quotes = [...all].sort((a, b) => (a.changePct || 0) - (b.changePct || 0)).slice(0, 12);
    else quotes = all.slice(0, 12);
    screenerCache[type] = { data: { quotes }, ts: Date.now() };
    res.json({ quotes });
  } catch (err) {
    console.error(`Screener (${type}) error:`, err.message);
    if (screenerCache[type]) return res.json(screenerCache[type].data);
    res.json({ quotes: [] });
  }
});

// ── Quotes: arbitrary symbols (Your List) ─────────────────────────────────────
router.get('/quotes', async (req, res) => {
  const symbols = (req.query.symbols || '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean).slice(0, 20);
  if (!symbols.length) return res.json({ quotes: [] });
  const key = symbols.slice().sort().join(',');
  if (quotesCache[key] && Date.now() - quotesCache[key].ts < CACHE.TICKERS) return res.json(quotesCache[key].data);
  if (!yahooFinance) return res.json({ quotes: [] });
  try {
    const results = await Promise.allSettled(symbols.map(s => yahooFinance.quote(s)));
    const quotes = results.map((r, i) => {
      if (r.status !== 'fulfilled' || !r.value) return null;
      const q = r.value;
      return { symbol: q.symbol || symbols[i], name: q.shortName || q.symbol || symbols[i], price: q.regularMarketPrice, change: q.regularMarketChange, changePct: q.regularMarketChangePercent };
    }).filter(Boolean);
    quotesCache[key] = { data: { quotes }, ts: Date.now() };
    res.json({ quotes });
  } catch (err) {
    console.error('Quotes error:', err.message);
    if (quotesCache[key]) return res.json(quotesCache[key].data);
    res.json({ quotes: [] });
  }
});

// ── Quotes extended: 1D / 1W / 1M % changes ──────────────────────────────────
const extendedCache = {};
router.get('/quotes-extended', async (req, res) => {
  const symbols = (req.query.symbols || '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean).slice(0, 20);
  if (!symbols.length) return res.json({ quotes: [] });
  const key = symbols.slice().sort().join(',');
  if (extendedCache[key] && Date.now() - extendedCache[key].ts < CACHE.TICKERS) return res.json(extendedCache[key].data);
  if (!yahooFinance) return res.json({ quotes: [] });
  try {
    const period1 = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000);
    const period2 = new Date();
    const results = await Promise.allSettled(
      symbols.map(s => yahooFinance.chart(s, { period1, period2, interval: '1d' }))
    );
    const quotes = results.map((r, i) => {
      if (r.status !== 'fulfilled') return { symbol: symbols[i], changePct1d: null, changePct1w: null, changePct1m: null };
      const candles = (r.value.quotes || []).filter(c => c.close != null);
      if (candles.length < 2) return { symbol: symbols[i], changePct1d: null, changePct1w: null, changePct1m: null };
      const last   = candles[candles.length - 1].close;
      const prev1d = candles[candles.length - 2].close;
      const prev1w = (candles.length >= 6 ? candles[candles.length - 6] : candles[0]).close;
      const prev1m = candles[0].close;
      return {
        symbol: symbols[i],
        changePct1d: ((last - prev1d) / prev1d) * 100,
        changePct1w: ((last - prev1w) / prev1w) * 100,
        changePct1m: ((last - prev1m) / prev1m) * 100,
      };
    });
    const data = { quotes };
    extendedCache[key] = { data, ts: Date.now() };
    res.json(data);
  } catch (err) {
    console.error('Quotes-extended error:', err.message);
    if (extendedCache[key]) return res.json(extendedCache[key].data);
    res.json({ quotes: [] });
  }
});

// ── Chart for any symbol ───────────────────────────────────────────────────────
router.get('/chart/:symbol', async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  const period = req.query.period || '3mo';
  const cacheKey = `sym-${symbol}-${period}`;
  if (chartCache[cacheKey] && Date.now() - chartCache[cacheKey].ts < CACHE.CHART) return res.json(chartCache[cacheKey].data);
  if (!yahooFinance) return res.json({ candles: [] });
  try {
    const daysMap = { '1wk': 9, '1mo': 35, '3mo': 92, '6mo': 183, '1y': 366 };
    const days = daysMap[period] || 92;
    const period1 = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const period2 = new Date();
    const result = await yahooFinance.chart(symbol, { period1, period2, interval: '1d' });
    const candles = (result.quotes || [])
      .filter(c => c.close != null)
      .map(c => ({
        date: c.date instanceof Date ? c.date.toISOString().slice(0, 10) : String(c.date).slice(0, 10),
        close: c.close, open: c.open, high: c.high, low: c.low,
      }));
    chartCache[cacheKey] = { data: { candles }, ts: Date.now() };
    res.json({ candles });
  } catch (err) {
    console.error(`Chart (${symbol}) error:`, err.message);
    if (chartCache[cacheKey]) return res.json(chartCache[cacheKey].data);
    res.json({ candles: [] });
  }
});

// ── S&P 500 historical chart ───────────────────────────────────────────────────
router.get('/sp500', async (req, res) => {
  const period = req.query.period || '3mo';
  const cacheKey = `sp500-${period}`;
  if (chartCache[cacheKey] && Date.now() - chartCache[cacheKey].ts < CACHE.CHART) {
    return res.json(chartCache[cacheKey].data);
  }
  if (!yahooFinance) return res.json({ candles: [] });
  try {
    const daysMap = { '1mo': 31, '3mo': 92, '6mo': 183, '1y': 366 };
    const days = daysMap[period] || 92;
    const period1 = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const period2 = new Date();
    const result = await yahooFinance.chart('^GSPC', { period1, period2, interval: '1d' });
    const candles = (result.quotes || [])
      .filter(c => c.close != null)
      .map(c => ({
        date: c.date instanceof Date ? c.date.toISOString().slice(0, 10) : String(c.date).slice(0, 10),
        close: c.close,
        open: c.open,
        high: c.high,
        low: c.low,
      }));
    console.log(`SP500 ${period}: ${candles.length} candles`);
    chartCache[cacheKey] = { data: { candles }, ts: Date.now() };
    res.json({ candles });
  } catch (err) {
    console.error('SP500 chart error:', err.message);
    if (chartCache[cacheKey]) return res.json(chartCache[cacheKey].data);
    res.json({ candles: [] });
  }
});

// ── US Treasury Yield Curve ───────────────────────────────────────────────────
router.get('/yield-curve', async (req, res) => {
  if (yieldCurveCache.data && Date.now() - yieldCurveCache.ts < CACHE.YIELD) return res.json(yieldCurveCache.data);
  if (!yahooFinance) return res.json({ tenors: [], date: null });
  try {
    const results = await Promise.allSettled(YIELD_SYMBOLS.map(s => yahooFinance.quote(s)));
    const tenors = results.map((r, i) => {
      if (r.status !== 'fulfilled') return null;
      const sym = YIELD_SYMBOLS[i];
      const rate = r.value.regularMarketPrice;
      return { label: YIELD_META[sym].label, years: YIELD_META[sym].years, rate: +rate.toFixed(3) };
    }).filter(Boolean);
    const result = { date: new Date().toISOString().slice(0, 10), tenors };
    yieldCurveCache = { data: result, ts: Date.now() };
    console.log(`Yield curve: ${tenors.map(t => `${t.label}=${t.rate}%`).join(', ')}`);
    res.json(result);
  } catch (err) {
    console.error('Yield curve error:', err.message);
    if (yieldCurveCache.data) return res.json(yieldCurveCache.data);
    res.json({ tenors: [], date: null });
  }
});

module.exports = router;
