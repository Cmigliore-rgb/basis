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

const CACHE = { FG: 15 * 60 * 1000, TICKERS: 2 * 60 * 1000, CHART: 10 * 60 * 1000, YIELD: 60 * 60 * 1000, SCREENER: 5 * 60 * 1000 };
let fgCache         = { data: null, ts: 0 };
let tickersCache    = { data: null, ts: 0 };
let yieldCurveCache = { data: null, ts: 0 };
let trendingCache   = { data: null, ts: 0 };
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
    const trending = await getTrendingTickers();
    const [indexRes, activeRes] = await Promise.allSettled([
      Promise.allSettled(INDICES.map(s => yahooFinance.quote(s))),
      yahooFinance.quote(trending.slice(0, 12)),
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

// ── Screener: most active / gainers / losers ──────────────────────────────────
const FALLBACK_TICKERS = ['AAPL','MSFT','NVDA','AMZN','GOOGL','TSLA','META','AMD','PLTR','MARA','SMCI','AVGO','NFLX','BABA','INTC','BAC','F','AAL','RIVN','NIO','JPM','GS','WMT','DIS','PYPL'];

async function getTrendingTickers() {
  if (trendingCache.data && Date.now() - trendingCache.ts < CACHE.SCREENER) return trendingCache.data;
  try {
    const r = await yahooFinance.trendingSymbols('US');
    const syms = (r.quotes || []).map(q => q.symbol).filter(Boolean).slice(0, 30);
    const tickers = syms.length >= 10 ? syms : FALLBACK_TICKERS;
    trendingCache = { data: tickers, ts: Date.now() };
    return tickers;
  } catch {
    trendingCache = { data: FALLBACK_TICKERS, ts: Date.now() };
    return FALLBACK_TICKERS;
  }
}

router.get('/screener', async (req, res) => {
  const VALID = ['most_actives', 'day_gainers', 'day_losers'];
  const type  = VALID.includes(req.query.type) ? req.query.type : 'most_actives';
  if (screenerCache[type] && Date.now() - screenerCache[type].ts < CACHE.SCREENER) return res.json(screenerCache[type].data);
  if (!yahooFinance) return res.json({ quotes: [] });
  try {
    const tickers = await getTrendingTickers();
    const mapQ = q => ({
      symbol: q.symbol,
      name: q.shortName || q.symbol,
      price: q.regularMarketPrice,
      change: q.regularMarketChange,
      changePct: q.regularMarketChangePercent,
    });
    const results = await yahooFinance.quote(tickers);
    const all = (Array.isArray(results) ? results : [results]).filter(Boolean).filter(q => q.regularMarketPrice).map(mapQ);
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

// ── Quotes extended: 1D / 5D / 1M / 6M / YTD / 1Y / 5Y % changes ────────────
const extendedCache = {};
router.get('/quotes-extended', async (req, res) => {
  const symbols = (req.query.symbols || '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean).slice(0, 20);
  if (!symbols.length) return res.json({ quotes: [] });
  const key = symbols.slice().sort().join(',');
  if (extendedCache[key] && Date.now() - extendedCache[key].ts < CACHE.TICKERS) return res.json(extendedCache[key].data);
  if (!yahooFinance) return res.json({ quotes: [] });
  try {
    // Fetch 5y+1mo of daily data to cover all periods including 5Y
    const period1 = new Date(Date.now() - (5 * 365 + 35) * 24 * 60 * 60 * 1000);
    const period2 = new Date();
    const results = await Promise.allSettled(
      symbols.map(s => yahooFinance.chart(s, { period1, period2, interval: '1d' }))
    );
    const ytdStart = new Date(new Date().getFullYear(), 0, 1);
    const empty = s => ({ symbol: s, changePct1d: null, changePct5d: null, changePct1mo: null, changePct6mo: null, changePctYTD: null, changePct1y: null, changePct5y: null });
    const quotes = results.map((r, i) => {
      if (r.status !== 'fulfilled') return empty(symbols[i]);
      const candles = (r.value.quotes || []).filter(c => c.close != null);
      if (candles.length < 2) return empty(symbols[i]);
      const last = candles[candles.length - 1].close;
      const ago = (days) => {
        const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
        for (let j = candles.length - 2; j >= 0; j--) {
          const d = new Date(candles[j].date).getTime();
          if (d <= cutoff) return candles[j].close;
        }
        return candles[0].close;
      };
      const agoDate = (d) => {
        const cutoff = d.getTime();
        for (let j = candles.length - 2; j >= 0; j--) {
          if (new Date(candles[j].date).getTime() <= cutoff) return candles[j].close;
        }
        return candles[0].close;
      };
      const pct = (prev) => prev ? ((last - prev) / prev) * 100 : null;
      return {
        symbol: symbols[i],
        changePct1d:  pct(candles[candles.length - 2].close),
        changePct5d:  pct(ago(7)),
        changePct1mo: pct(ago(35)),
        changePct6mo: pct(ago(185)),
        changePctYTD: pct(agoDate(ytdStart)),
        changePct1y:  pct(ago(370)),
        changePct5y:  pct(ago(1830)),
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

// ── Portfolio performance vs S&P 500 ─────────────────────────────────────────
const portfolioPerfCache = {};
router.get('/portfolio-perf', async (req, res) => {
  const rawPos = (req.query.positions || '').split(',').filter(Boolean);
  const VALID_PERIODS = ['1d','5d','1mo','3mo','6mo','ytd','1y','5y','max'];
  const period = VALID_PERIODS.includes(req.query.period) ? req.query.period : '3mo';
  if (!rawPos.length || !yahooFinance) return res.json({ portfolio: [], sp500: [] });

  const positions = rawPos.map(p => {
    const [sym, qty] = p.split(':');
    return { sym: (sym || '').toUpperCase(), qty: parseFloat(qty) || 0 };
  }).filter(p => p.sym && p.qty > 0).slice(0, 20);
  if (!positions.length) return res.json({ portfolio: [], sp500: [] });

  const cacheKey = positions.map(p => `${p.sym}:${p.qty}`).sort().join(',') + '-' + period;
  if (portfolioPerfCache[cacheKey] && Date.now() - portfolioPerfCache[cacheKey].ts < CACHE.CHART) {
    return res.json(portfolioPerfCache[cacheKey].data);
  }

  try {
    const daysMap = { '1d': 4, '5d': 9, '1mo': 35, '3mo': 95, '6mo': 185, 'ytd': null, '1y': 370, '5y': 1830, 'max': 7300 };
    let period1;
    if (period === 'ytd') {
      period1 = new Date(new Date().getFullYear(), 0, 1);
    } else {
      period1 = new Date(Date.now() - (daysMap[period] || 95) * 24 * 60 * 60 * 1000);
    }
    const interval = (period === '1d' || period === '5d') ? '1h' : '1d';
    const period2 = new Date();
    const symbols  = positions.map(p => p.sym);
    const allSyms  = [...symbols, '^GSPC'];

    const results = await Promise.allSettled(
      allSyms.map(s => yahooFinance.chart(s, { period1, period2, interval }))
    );

    const charts = {};
    allSyms.forEach((s, i) => {
      charts[s] = results[i].status === 'fulfilled'
        ? (results[i].value.quotes || []).filter(c => c.close != null)
        : [];
    });

    const sp500 = charts['^GSPC'];
    if (!sp500.length) return res.json({ portfolio: [], sp500: [] });
    const spFirst = sp500[0].close;

    // Use full ISO timestamp as key for hourly data so each candle gets its own slot
    const toKey  = c => (c.date instanceof Date ? c.date : new Date(c.date)).toISOString().slice(0, interval === '1h' ? 13 : 10);
    const toDate = c => (c.date instanceof Date ? c.date : new Date(c.date)).toISOString().slice(0, 10);

    const firstPx  = {};
    const dateMaps = {};
    positions.forEach(p => {
      if (charts[p.sym]?.length) firstPx[p.sym] = charts[p.sym][0].close;
      dateMaps[p.sym] = {};
      (charts[p.sym] || []).forEach(c => { dateMaps[p.sym][toKey(c)] = c.close; });
    });

    const startVal = positions.reduce((s, p) => s + p.qty * (firstPx[p.sym] || 0), 0);
    if (!startVal) return res.json({ portfolio: [], sp500: [] });

    // Carry-forward: maintain last-known price per symbol so missing dates never
    // snap back to the period-start price (the source of flat segments).
    const carryPx = {};
    positions.forEach(p => { carryPx[p.sym] = firstPx[p.sym] || 0; });

    const portfolio = sp500.map(c => {
      const key = toKey(c);
      let dayVal = 0;
      positions.forEach(p => {
        if (dateMaps[p.sym][key] != null) carryPx[p.sym] = dateMaps[p.sym][key];
        dayVal += p.qty * carryPx[p.sym];
      });
      return { date: toDate(c), value: +((dayVal / startVal) * 100).toFixed(2) };
    });

    const sp500Series = sp500.map(c => ({ date: toDate(c), value: +((c.close / spFirst) * 100).toFixed(2) }));
    const data = { portfolio, sp500: sp500Series };
    portfolioPerfCache[cacheKey] = { data, ts: Date.now() };
    res.json(data);
  } catch (err) {
    console.error('Portfolio perf error:', err.message);
    res.json({ portfolio: [], sp500: [] });
  }
});

// ── Sector allocation for holdings ───────────────────────────────────────────
const sectorCache = {};
const ETF_SECTOR_MAP = {
  SPY:'Broad Market', VOO:'Broad Market', VTI:'Broad Market', IVV:'Broad Market', SCHB:'Broad Market', ITOT:'Broad Market', SCHD:'Broad Market', DVY:'Broad Market', VYM:'Broad Market',
  QQQ:'Technology', VGT:'Technology', XLK:'Technology', TQQQ:'Technology',
  XLE:'Energy', XLF:'Financial Services', XLV:'Healthcare', XLI:'Industrials',
  XLC:'Communication Services', XLY:'Consumer Cyclical', XLP:'Consumer Defensive',
  XLB:'Basic Materials', XLRE:'Real Estate', XLU:'Utilities',
  GLD:'Commodities', SLV:'Commodities', GDX:'Commodities',
  TLT:'Bonds', BND:'Bonds', AGG:'Bonds', HYG:'Bonds', LQD:'Bonds', BNDX:'Bonds',
  VHT:'Healthcare', VFH:'Financial Services', VDE:'Energy', VNQ:'Real Estate',
  ARKK:'Technology', ARKG:'Healthcare', ARKW:'Technology', ARKF:'Technology',
  VEA:'International', VXUS:'International', EFA:'International', EEM:'Emerging Markets',
};

router.get('/sector-alloc', async (req, res) => {
  const symbols = (req.query.symbols || '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean).slice(0, 25);
  if (!symbols.length || !yahooFinance) return res.json({ sectors: [] });
  const key = symbols.slice().sort().join(',');
  if (sectorCache[key] && Date.now() - sectorCache[key].ts < 6 * 60 * 60 * 1000) return res.json(sectorCache[key].data);
  try {
    const results = await Promise.allSettled(symbols.map(s => yahooFinance.quote(s)));
    const sectors = results.map((r, i) => {
      const sym = symbols[i];
      if (r.status !== 'fulfilled' || !r.value) return { symbol: sym, sector: ETF_SECTOR_MAP[sym] || 'Other' };
      const q = r.value;
      const sector = q.sector || ETF_SECTOR_MAP[sym] || (q.quoteType === 'ETF' ? 'ETF' : q.quoteType === 'MUTUALFUND' ? 'Fund' : 'Other');
      return { symbol: q.symbol || sym, sector };
    });
    const data = { sectors };
    sectorCache[key] = { data, ts: Date.now() };
    res.json(data);
  } catch (err) {
    console.error('Sector alloc error:', err.message);
    res.json({ sectors: [] });
  }
});

module.exports = router;
