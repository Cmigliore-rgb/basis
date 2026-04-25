const express = require('express');
const router = express.Router();

let yahooFinance = null;
try {
  const mod = require('yahoo-finance2');
  const Ctor = mod.YahooFinance || (typeof mod.default === 'function' ? mod.default : null) || (typeof mod === 'function' ? mod : null);
  if (Ctor) yahooFinance = new Ctor({ suppressNotices: ['yahooSurvey'] });
  else console.warn('yahoo-finance2: unexpected export shape', Object.keys(mod));
} catch (e) { console.warn('yahoo-finance2 init failed (options):', e.message); }

const RISK_FREE_RATE = 0.043;

function normalCDF(x) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const poly = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const p = 1 - (Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI)) * poly;
  return x >= 0 ? p : 1 - p;
}

function normalPDF(x) {
  return Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI);
}

function calcGreeks(S, K, T, r, sigma, isCall) {
  if (T <= 0 || sigma <= 0 || S <= 0 || K <= 0) return { delta: null, gamma: null, theta: null, vega: null };
  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r + sigma * sigma / 2) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;
  const nd1 = normalPDF(d1);
  const delta = isCall ? normalCDF(d1) : normalCDF(d1) - 1;
  const gamma = nd1 / (S * sigma * sqrtT);
  const theta = isCall
    ? (-S * nd1 * sigma / (2 * sqrtT) - r * K * Math.exp(-r * T) * normalCDF(d2)) / 365
    : (-S * nd1 * sigma / (2 * sqrtT) + r * K * Math.exp(-r * T) * normalCDF(-d2)) / 365;
  const vega = S * nd1 * sqrtT / 100;
  return {
    delta: +delta.toFixed(4),
    gamma: +gamma.toFixed(4),
    theta: +theta.toFixed(4),
    vega:  +vega.toFixed(4),
  };
}

const cache = {};
const CACHE_TTL = 5 * 60 * 1000;

router.get('/:ticker', async (req, res) => {
  const ticker = req.params.ticker.toUpperCase();
  const expiration = req.query.expiration;
  const cacheKey = `${ticker}-${expiration || 'default'}`;

  if (cache[cacheKey] && Date.now() - cache[cacheKey].ts < CACHE_TTL) {
    return res.json(cache[cacheKey].data);
  }
  if (!yahooFinance) return res.status(503).json({ error: 'Yahoo Finance not available' });

  try {
    const queryOpts = expiration ? { date: new Date(expiration) } : {};
    const [quoteRes, optionsRes] = await Promise.allSettled([
      yahooFinance.quote(ticker),
      yahooFinance.options(ticker, queryOpts),
    ]);

    if (quoteRes.status !== 'fulfilled') throw new Error(`No quote data for ${ticker}`);
    if (optionsRes.status !== 'fulfilled') throw new Error(`No options data for ${ticker}: ${optionsRes.reason?.message}`);

    const S = quoteRes.value.regularMarketPrice;
    const optData = optionsRes.value;

    const expirations = (optData.expirationDates || []).map(d =>
      d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10)
    );

    const chain = optData.options?.[0];
    if (!chain) return res.json({ ticker, price: S, expirations, expiration: null, calls: [], puts: [] });

    const expiryDate = chain.expirationDate instanceof Date
      ? chain.expirationDate
      : new Date(chain.expirationDate * 1000);
    const T = Math.max((expiryDate.getTime() - Date.now()) / (365 * 24 * 60 * 60 * 1000), 0.001);

    const mapContract = (c, isCall) => {
      const sigma = c.impliedVolatility || 0;
      return {
        strike: c.strike,
        lastPrice: c.lastPrice,
        bid: c.bid,
        ask: c.ask,
        volume: c.volume || 0,
        openInterest: c.openInterest || 0,
        iv: sigma ? +(sigma * 100).toFixed(1) : null,
        inTheMoney: c.inTheMoney || false,
        ...calcGreeks(S, c.strike, T, RISK_FREE_RATE, sigma, isCall),
      };
    };

    const result = {
      ticker,
      price: S,
      expirations,
      expiration: expiryDate.toISOString().slice(0, 10),
      calls: (chain.calls || []).map(c => mapContract(c, true)),
      puts:  (chain.puts  || []).map(c => mapContract(c, false)),
    };
    cache[cacheKey] = { data: result, ts: Date.now() };
    console.log(`Options ${ticker} ${result.expiration}: ${result.calls.length} calls, ${result.puts.length} puts`);
    res.json(result);
  } catch (err) {
    console.error('Options error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
