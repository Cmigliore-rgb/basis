const express = require('express');
const router = express.Router();
const axios = require('axios');

let yahooFinance = null;
try {
  const mod = require('yahoo-finance2');
  // v3 exports the class as the module itself or as .YahooFinance
  const Ctor = mod.YahooFinance || (typeof mod.default === 'function' ? mod.default : null) || (typeof mod === 'function' ? mod : null);
  if (Ctor) yahooFinance = new Ctor({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });
  else console.warn('yahoo-finance2: unexpected export shape', Object.keys(mod));
} catch (e) { console.warn('yahoo-finance2 init failed:', e.message); }

const CACHE = { FG: 15 * 60 * 1000, TICKERS: 2 * 60 * 1000, CHART: 10 * 60 * 1000 };
let fgCache      = { data: null, ts: 0 };
let tickersCache = { data: null, ts: 0 };
const chartCache = {};

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
      yahooFinance.screener({ scrIds: 'most_actives', count: 12, region: 'US', lang: 'en-US' }),
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

    const active = activeRes.status === 'fulfilled' && activeRes.value?.quotes
      ? activeRes.value.quotes.filter(q => q.symbol && !q.symbol.startsWith('^')).slice(0, 12).map(mapQuote)
      : [];

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

module.exports = router;
