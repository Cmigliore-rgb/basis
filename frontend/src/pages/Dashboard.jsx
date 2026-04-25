import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';
import PlaidLink from '../features/plaid/PlaidLink';
import TellerConnect from '../features/teller/TellerConnect';

const BG       = '#0f0f0f';
const SIDE_BG  = '#141414';
const CARD_BG  = '#1c1c1e';
const BORDER_C = '#2a2a2a';
const BORDER   = `1px solid ${BORDER_C}`;
const TEXT     = '#f0f0f0';
const TEXT2    = '#8e8e93';
const TEXT3    = '#555';
const MUTED    = '#2a2a2a';
const BLUE     = '#4da3ff';
const BLUE_BTN = '#0066f5';
const RED      = '#f87171';
const GREEN    = '#4ade80';
const YELLOW   = '#fbbf24';

const CARD = { background: CARD_BG, border: BORDER, borderRadius: 10, padding: 24 };

const NAV = [
  { key: 'overview',    label: 'Overview',    icon: '⊞' },
  { key: 'banking',     label: 'Banking',     icon: '⬡' },
  { key: 'investments', label: 'Investments', icon: '◈' },
  { key: 'budgeting',   label: 'Budgeting',   icon: '◎' },
  { key: 'trends',      label: 'Trends',         icon: '◬' },
  { key: 'subscriptions', label: 'Subscriptions', icon: '↻' },
  { key: 'goals',         label: 'Goals',          icon: '◎' },
  { key: 'news',        label: 'News Feed',      icon: '◉' },
  { key: 'learn',       label: 'Learn',          icon: '◈' },
  { key: 'assistant',   label: 'AI Assistant',icon: '✦' },
];

const fmt = (n) =>
  typeof n === 'number'
    ? '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '—';

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';

// Simple SVG line chart
function NetWorthChart({ snapshots }) {
  if (!snapshots || snapshots.length === 0) {
    return (
      <div style={{ height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', color: TEXT2, fontSize: 13 }}>
        No data yet — will populate on first load
      </div>
    );
  }
  if (snapshots.length === 1) {
    return (
      <div style={{ padding: '16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: TEXT2, fontSize: 13 }}>Started tracking today — chart fills in over time</span>
        <span style={{ fontWeight: 700, fontSize: 18, fontFamily: 'monospace' }}>{fmt(snapshots[0].value)}</span>
      </div>
    );
  }

  const W = 600, H = 140, PAD = { top: 16, right: 16, bottom: 28, left: 64 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const values = snapshots.map(s => s.value);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const range = maxV - minV || 1;

  const toX = (i) => PAD.left + (i / (snapshots.length - 1)) * innerW;
  const toY = (v) => PAD.top + innerH - ((v - minV) / range) * innerH;

  const points = snapshots.map((s, i) => `${toX(i)},${toY(s.value)}`).join(' ');
  const areaPoints = `${PAD.left},${PAD.top + innerH} ${points} ${toX(snapshots.length - 1)},${PAD.top + innerH}`;

  // Pick a few evenly-spaced x-axis labels
  const labelCount = Math.min(snapshots.length, 6);
  const labelIdxs = Array.from({ length: labelCount }, (_, i) =>
    Math.round((i / (labelCount - 1)) * (snapshots.length - 1))
  );

  const latest = values[values.length - 1];
  const first  = values[0];
  const gain   = latest - first;
  const gainColor = gain >= 0 ? GREEN : RED;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
        <span style={{ fontSize: 13, color: TEXT2 }}>Last {snapshots.length} day{snapshots.length !== 1 ? 's' : ''}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: gainColor, fontFamily: 'monospace' }}>
          {gain >= 0 ? '+' : ''}{fmt(gain)}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {/* Y-axis labels */}
        {[0, 0.5, 1].map(t => {
          const v = minV + t * range;
          const y = toY(v);
          return (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke={BORDER_C} strokeWidth={1} />
              <text x={PAD.left - 6} y={y + 4} textAnchor="end" fontSize={10} fill={TEXT3}>
                ${(v / 1000).toFixed(0)}k
              </text>
            </g>
          );
        })}

        {/* Area fill */}
        <polygon points={areaPoints} fill={BLUE_BTN} fillOpacity={0.08} />

        {/* Line */}
        <polyline points={points} fill="none" stroke={BLUE} strokeWidth={2} strokeLinejoin="round" />

        {/* Dots at endpoints */}
        <circle cx={toX(0)} cy={toY(values[0])} r={3} fill={BLUE} />
        <circle cx={toX(snapshots.length - 1)} cy={toY(values[values.length - 1])} r={4} fill={BLUE} />

        {/* X-axis labels */}
        {labelIdxs.map(i => (
          <text key={i} x={toX(i)} y={H - 4} textAnchor="middle" fontSize={10} fill={TEXT3}>
            {new Date(snapshots[i].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </text>
        ))}
      </svg>
    </div>
  );
}

function TickerBar({ indices, active }) {
  const all = [...indices, ...active];
  if (!all.length) return null;

  const item = (t, key) => (
    <span key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginRight: 32, whiteSpace: 'nowrap' }}>
      <span style={{ fontSize: 12, color: TEXT2, fontWeight: 700 }}>{t.name}</span>
      <span style={{ fontFamily: 'monospace', fontSize: 13, color: TEXT }}>
        {(t.price || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
      <span style={{ fontSize: 11, fontWeight: 600, color: (t.changePct || 0) >= 0 ? GREEN : RED }}>
        {(t.changePct || 0) >= 0 ? '▲' : '▼'} {Math.abs(t.changePct || 0).toFixed(2)}%
      </span>
      <span style={{ color: BORDER_C, fontSize: 11 }}>│</span>
    </span>
  );

  return (
    <div style={{ height: 42, background: SIDE_BG, borderBottom: BORDER, display: 'flex', alignItems: 'center', overflow: 'hidden', flexShrink: 0 }}>
      <div className="ticker-scroll">
        {all.map((t, i) => item(t, i))}
        {all.map((t, i) => item(t, i + all.length))}
      </div>
    </div>
  );
}

function SP500Chart({ candles, period, onPeriodChange }) {
  if (!candles || candles.length < 2) {
    return (
      <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: TEXT2, fontSize: 13 }}>
        {!candles || candles.length === 0 ? 'Chart unavailable' : 'Loading chart…'}
      </div>
    );
  }

  const W = 600, H = 180, PAD = { top: 20, right: 16, bottom: 30, left: 72 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const values = candles.map(c => c.close);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const range = maxV - minV || 1;

  const toX = i => PAD.left + (i / (candles.length - 1)) * innerW;
  const toY = v => PAD.top + innerH - ((v - minV) / range) * innerH;

  const points = candles.map((c, i) => `${toX(i).toFixed(1)},${toY(c.close).toFixed(1)}`).join(' ');
  const areaPoints = `${PAD.left},${PAD.top + innerH} ${points} ${toX(candles.length - 1).toFixed(1)},${PAD.top + innerH}`;

  const first = values[0];
  const last  = values[values.length - 1];
  const change = last - first;
  const changePct = (change / first) * 100;
  const lineColor = change >= 0 ? GREEN : RED;
  const fillId = change >= 0 ? 'sp500g' : 'sp500r';

  const labelIdxs = Array.from({ length: Math.min(candles.length, 6) }, (_, i) =>
    Math.round((i / (Math.min(candles.length, 6) - 1)) * (candles.length - 1))
  );

  const PERIODS = [
    { key: '1mo', label: '1M' }, { key: '3mo', label: '3M' },
    { key: '6mo', label: '6M' }, { key: '1y',  label: '1Y' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'baseline' }}>
          <span style={{ fontFamily: 'monospace', fontSize: 22, fontWeight: 700 }}>
            {last.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span style={{ fontSize: 13, fontWeight: 600, color: lineColor }}>
            {change >= 0 ? '+' : ''}{change.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            {' '}({changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%)
          </span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {PERIODS.map(({ key, label }) => (
            <button key={key} onClick={() => onPeriodChange(key)} style={{
              padding: '4px 12px', borderRadius: 6, border: 'none', fontSize: 12,
              cursor: 'pointer', fontWeight: 600, transition: 'background 0.15s',
              background: period === key ? BLUE_BTN : MUTED,
              color: period === key ? '#fff' : TEXT2,
            }}>{label}</button>
          ))}
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        <defs>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity={0.18} />
            <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map(t => {
          const v = minV + t * range;
          const y = toY(v);
          return (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke={BORDER_C} strokeWidth={1} strokeDasharray="4 4" />
              <text x={PAD.left - 6} y={y + 4} textAnchor="end" fontSize={10} fill={TEXT3}>
                {v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v.toFixed(0)}
              </text>
            </g>
          );
        })}
        <polygon points={areaPoints} fill={`url(#${fillId})`} />
        <polyline points={points} fill="none" stroke={lineColor} strokeWidth={1.8} strokeLinejoin="round" />
        <circle cx={toX(candles.length - 1)} cy={toY(last)} r={3.5} fill={lineColor} />
        {labelIdxs.map(i => (
          <text key={i} x={toX(i)} y={H - 4} textAnchor="middle" fontSize={10} fill={TEXT3}>
            {new Date(candles[i].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </text>
        ))}
      </svg>
    </div>
  );
}

function FearGreedGauge({ score, rating }) {
  if (score == null) return null;
  const W = 200, H = 122, CX = 100, CY = 108, R = 80;

  const scoreToAngle = s => Math.PI - (s / 100) * Math.PI;
  const arcPoint = (s, r = R) => {
    const a = scoreToAngle(s);
    return { x: CX + r * Math.cos(a), y: CY - r * Math.sin(a) };
  };
  const arcPath = (from, to) => {
    const p1 = arcPoint(from), p2 = arcPoint(to);
    return `M ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} A ${R} ${R} 0 0 1 ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  };

  const ZONES = [
    { from: 0,  to: 25,  color: '#ef4444' },
    { from: 25, to: 45,  color: '#f97316' },
    { from: 45, to: 55,  color: '#eab308' },
    { from: 55, to: 75,  color: '#22c55e' },
    { from: 75, to: 100, color: '#16a34a' },
  ];
  const zoneColor = ZONES.find(z => score <= z.to)?.color || '#16a34a';
  const needle = arcPoint(score, R * 0.82);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <path d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`} fill="none" stroke={MUTED} strokeWidth={14} strokeLinecap="round" />
      {ZONES.map(z => <path key={z.from} d={arcPath(z.from, z.to)} fill="none" stroke={z.color} strokeWidth={14} strokeLinecap="butt" />)}
      <line x1={CX} y1={CY} x2={needle.x.toFixed(1)} y2={needle.y.toFixed(1)} stroke="#fff" strokeWidth={2.5} strokeLinecap="round" />
      <circle cx={CX} cy={CY} r={5} fill="#fff" />
      <text x={CX} y={CY - 26} textAnchor="middle" fontSize={26} fontWeight="700" fill={zoneColor}>{score}</text>
      <text x={CX} y={CY - 10} textAnchor="middle" fontSize={10} fill={TEXT2}>{rating}</text>
      <text x={CX - R + 2} y={H - 1} textAnchor="start" fontSize={7.5} fill={TEXT3}>Extreme Fear</text>
      <text x={CX + R - 2} y={H - 1} textAnchor="end" fontSize={7.5} fill={TEXT3}>Extreme Greed</text>
    </svg>
  );
}

function AdviceBox({ onGetAdvice, loading, text }) {
  return (
    <div style={{ marginTop: 20 }}>
      <button
        onClick={onGetAdvice}
        disabled={loading}
        style={{
          padding: '8px 18px', background: '#0d1f3c', color: BLUE,
          border: `1px solid ${BLUE}`, borderRadius: 8,
          cursor: loading ? 'default' : 'pointer', fontSize: 13, fontWeight: 600,
          display: 'inline-flex', alignItems: 'center', gap: 6, opacity: loading ? 0.75 : 1,
        }}
      >
        <span style={{ fontSize: 15 }}>✦</span>
        {loading ? 'Analyzing…' : 'Get Recommendation'}
      </button>
      <div style={{ marginTop: 6, fontSize: 11, color: TEXT3, maxWidth: 560 }}>
        AI-generated recommendations are for informational purposes only and do not constitute financial, investment, tax, or legal advice. Ledger and its developers are not liable for any decisions made based on these suggestions. Always consult a qualified professional before acting on financial information.
      </div>
      {text && (
        <div style={{ marginTop: 12, padding: '14px 18px', background: '#0a1628', border: `1px solid #1a3a6b`, borderRadius: 8, fontSize: 13, lineHeight: 1.65, color: TEXT, whiteSpace: 'pre-wrap' }}>
          {text}
        </div>
      )}
    </div>
  );
}

function OptionsChain() {
  const [input, setInput] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('calls');
  const [expiry, setExpiry] = useState('');

  const load = async (ticker, exp) => {
    setLoading(true); setError('');
    try {
      const params = exp ? { expiration: exp } : {};
      const r = await api.get(`/options/${encodeURIComponent(ticker)}`, { params });
      setData(r.data);
      if (!exp && r.data.expiration) setExpiry(r.data.expiration);
    } catch (e) {
      setError(e.response?.data?.error || 'Could not load options data');
    } finally { setLoading(false); }
  };

  const handleSearch = () => { if (input.trim()) load(input.trim().toUpperCase(), ''); };
  const handleExpiry = (e) => { setExpiry(e.target.value); load(data.ticker, e.target.value); };

  const contracts = data ? (mode === 'calls' ? data.calls : data.puts) : [];
  const ATM_RANGE = data ? data.price * 0.10 : 0;

  const gFmt = (v, dec = 4) => v == null ? '—' : v.toFixed(dec);
  const BTN = (active) => ({
    padding: '5px 14px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600,
    cursor: 'pointer', background: active ? BLUE_BTN : MUTED, color: active ? '#fff' : TEXT2,
  });

  return (
    <div className="lc" style={{ ...CARD, marginTop: 24 }}>
      <div style={{ fontWeight: 600, marginBottom: 16, fontSize: 15 }}>Options Chain
        <span style={{ fontSize: 11, color: TEXT2, fontWeight: 400, marginLeft: 8 }}>Black-Scholes Greeks · live data</span>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', background: MUTED, border: BORDER, borderRadius: 7, padding: '6px 10px', gap: 4 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="AAPL, TSLA, SPY…"
            style={{ background: 'none', border: 'none', outline: 'none', color: TEXT, fontSize: 13, fontFamily: 'monospace', width: 130 }}
          />
        </div>
        <button onClick={handleSearch} disabled={loading || !input.trim()} style={{ ...BTN(true), opacity: loading || !input.trim() ? 0.6 : 1 }}>
          {loading ? 'Loading…' : 'Load'}
        </button>
        {data && (
          <>
            <select value={expiry} onChange={handleExpiry} style={{ background: MUTED, border: BORDER, borderRadius: 6, color: TEXT, fontSize: 12, padding: '5px 10px', cursor: 'pointer' }}>
              {data.expirations.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <button onClick={() => setMode('calls')} style={BTN(mode === 'calls')}>Calls</button>
            <button onClick={() => setMode('puts')}  style={BTN(mode === 'puts')}>Puts</button>
            <span style={{ fontSize: 13, color: TEXT2, marginLeft: 4 }}>
              {data.ticker} @ <span style={{ color: TEXT, fontWeight: 700, fontFamily: 'monospace' }}>{fmt(data.price)}</span>
            </span>
          </>
        )}
      </div>

      {error && <div style={{ color: RED, fontSize: 13, marginBottom: 12 }}>{error}</div>}

      {data && contracts.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
            <thead>
              <tr style={{ borderBottom: BORDER }}>
                {['Strike','Last','Bid','Ask','Volume','OI','IV %','Δ Delta','Γ Gamma','Θ Theta','V Vega'].map(h => (
                  <th key={h} style={{ padding: '6px 10px', textAlign: h === 'Strike' ? 'left' : 'right', fontSize: 10, color: TEXT2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {contracts.map((c, i) => {
                const nearATM = data && Math.abs(c.strike - data.price) <= ATM_RANGE;
                const rowBg = c.inTheMoney ? 'rgba(74,222,128,0.05)' : 'transparent';
                return (
                  <tr key={i} className="lr" style={{ borderBottom: `1px solid ${BORDER_C}`, background: rowBg }}>
                    <td style={{ padding: '7px 10px', fontWeight: nearATM ? 700 : 500, color: nearATM ? YELLOW : TEXT, fontFamily: 'monospace', fontSize: 12 }}>
                      {c.inTheMoney && <span style={{ fontSize: 9, color: GREEN, marginRight: 4 }}>ITM</span>}
                      {fmt(c.strike)}
                    </td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>{c.lastPrice != null ? fmt(c.lastPrice) : '—'}</td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12, color: TEXT2 }}>{c.bid != null ? fmt(c.bid) : '—'}</td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12, color: TEXT2 }}>{c.ask != null ? fmt(c.ask) : '—'}</td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12, color: TEXT2 }}>{c.volume?.toLocaleString() || '—'}</td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12, color: TEXT2 }}>{c.openInterest?.toLocaleString() || '—'}</td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>{c.iv != null ? `${c.iv}%` : '—'}</td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12, color: BLUE }}>{gFmt(c.delta)}</td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12, color: TEXT2 }}>{gFmt(c.gamma)}</td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12, color: RED }}>{gFmt(c.theta)}</td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12, color: GREEN }}>{gFmt(c.vega)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {data && contracts.length === 0 && !loading && (
        <div style={{ color: TEXT2, fontSize: 13, padding: '16px 0' }}>No {mode} contracts found for this expiration.</div>
      )}
      {!data && !loading && !error && (
        <div style={{ color: TEXT3, fontSize: 13 }}>Enter a ticker and click Load to see live options data with Greeks.</div>
      )}
    </div>
  );
}

const LEARN_CONTENT = [
  {
    category: 'markets',
    label: 'Markets & Economy',
    color: '#4da3ff',
    items: [
      { id: 'indices', title: 'Market Indices', icon: '📈',
        summary: 'Benchmarks that track a basket of stocks to measure overall market performance.',
        body: 'The S&P 500 tracks the 500 largest U.S. companies and is the most widely used measure of stock market health. The Dow Jones Industrial Average (DJIA) tracks just 30 large blue-chip companies. The Nasdaq Composite is tech-heavy and includes over 3,000 companies listed on the Nasdaq exchange.',
        formula: null,
        example: 'If the S&P 500 is up 1.2% today, the average large-cap U.S. stock gained roughly 1.2%.' },
      { id: 'feargreed', title: 'Fear & Greed Index', icon: '🌡️',
        summary: 'A CNN composite score (0–100) measuring whether investors are fearful or greedy.',
        body: 'The index combines 7 indicators: stock price momentum, stock price strength, stock price breadth, put/call ratio, junk bond demand, market volatility (VIX), and safe-haven demand. Extreme Fear (0–25) often signals a buying opportunity; Extreme Greed (75–100) may signal overvaluation.',
        formula: null,
        example: 'A score of 18 means "Extreme Fear" — historically a period where patient investors buy at a discount.' },
      { id: 'marketcap', title: 'Market Capitalization', icon: '🏢',
        summary: 'The total market value of a company\'s outstanding shares.',
        body: 'Market cap = Share Price × Shares Outstanding. Categories: Mega-cap (>$200B), Large-cap ($10B–$200B), Mid-cap ($2B–$10B), Small-cap ($300M–$2B), Micro-cap (<$300M). Large-caps are generally more stable; small-caps offer higher growth potential with more risk.',
        formula: 'Market Cap = Price × Shares Outstanding',
        example: 'Apple at $200/share × 15.3B shares = ~$3.06 trillion market cap.' },
      { id: 'bull-bear', title: 'Bull vs. Bear Markets', icon: '🐂',
        summary: 'A bull market rises 20%+ from a recent low; a bear market falls 20%+ from a recent high.',
        body: 'Bull markets are periods of rising prices and investor optimism, typically driven by strong economic growth. Bear markets are prolonged downturns of 20% or more, often linked to recessions. The average bull market lasts ~5 years; the average bear market lasts ~9 months.',
        formula: null,
        example: 'The 2020 COVID crash was a bear market (−34% in 33 days), followed by one of history\'s fastest bull recoveries.' },
    ],
  },
  {
    category: 'options',
    label: 'Options Trading',
    color: '#fbbf24',
    items: [
      { id: 'calls-puts', title: 'Calls & Puts', icon: '⚖️',
        summary: 'A call gives the right to buy; a put gives the right to sell.',
        body: 'A call option gives you the right (but not obligation) to buy 100 shares of a stock at the strike price before expiration. You buy calls when you expect the stock to rise. A put option gives you the right to sell 100 shares at the strike price — you buy puts when you expect a decline or want downside protection.',
        formula: null,
        example: 'You buy an AAPL $200 call expiring in 30 days for $3.50 ($350 total). If AAPL hits $215, your call is worth ~$15 — a 4× gain.' },
      { id: 'itm-otm', title: 'ITM / ATM / OTM', icon: '🎯',
        summary: 'Describes whether the strike price is favorable relative to the current stock price.',
        body: 'In The Money (ITM): for a call, the stock price is above the strike — the option has intrinsic value. At The Money (ATM): stock price equals the strike. Out of The Money (OTM): for a call, the stock is below the strike — the option has only time value. ITM options cost more but are less risky; OTM options are cheaper but expire worthless more often.',
        formula: null,
        example: 'Stock at $150. A $140 call is ITM (intrinsic value $10). A $150 call is ATM. A $160 call is OTM.' },
      { id: 'iv', title: 'Implied Volatility', icon: '〰️',
        summary: 'The market\'s forecast of how much a stock will move, expressed as an annual % standard deviation.',
        body: 'IV is derived from the market price of an option using the Black-Scholes model — it\'s what\'s implied by what people are willing to pay. High IV means the market expects big moves; options are expensive. Low IV means calm expectations; options are cheap. IV spikes before earnings announcements and major events.',
        formula: 'IV is extracted from option price by solving Black-Scholes for σ',
        example: 'AAPL IV of 28% means the market expects AAPL to move ±28% over the next year, or roughly ±1.8% per week.' },
      { id: 'delta', title: 'Delta (Δ)', icon: 'Δ',
        summary: 'How much the option price moves per $1 move in the stock. Also approximates probability of expiring ITM.',
        body: 'Delta ranges from 0 to 1 for calls (0 to −1 for puts). A delta of 0.50 means the option gains $0.50 for every $1 rise in the stock. Deep ITM options have delta near 1 (move dollar-for-dollar with stock). Deep OTM options have delta near 0. A 0.30 delta call has roughly 30% probability of expiring in the money.',
        formula: 'Δ = ∂V/∂S = N(d₁) for calls, N(d₁)−1 for puts',
        example: 'You hold 1 AAPL call with Δ=0.45. AAPL rises $5 → your option gains ~$2.25.' },
      { id: 'gamma', title: 'Gamma (Γ)', icon: 'Γ',
        summary: 'The rate of change of delta per $1 move in the stock. Highest near ATM and near expiration.',
        body: 'Gamma measures how quickly your delta changes. High gamma means your position becomes more directional faster as the stock moves. Gamma is highest for ATM options close to expiration — small stock moves can cause large swings in option value. Long options have positive gamma; short options have negative gamma.',
        formula: 'Γ = N\'(d₁) / (S · σ · √T)',
        example: 'Delta is 0.50, Gamma is 0.05. If stock rises $1 → delta becomes 0.55. Another $1 → delta ~0.60.' },
      { id: 'theta', title: 'Theta (Θ)', icon: 'Θ',
        summary: 'Daily time decay — how much option value is lost per day, all else equal.',
        body: 'Every day that passes, an option loses value simply due to the passage of time — this is time decay. Theta is negative for option buyers (you lose value each day) and positive for sellers. Theta accelerates as expiration approaches, especially in the final 30 days. This is why option sellers love time, and buyers prefer longer expirations.',
        formula: 'Θ ≈ [−S·N\'(d₁)·σ / (2√T) − rKe^(−rT)·N(d₂)] / 365',
        example: 'Your option has Θ = −0.05. Over a weekend (3 days), it loses ~$0.15 in value with no stock movement.' },
      { id: 'vega', title: 'Vega (V)', icon: 'V',
        summary: 'How much the option price changes per 1% change in implied volatility.',
        body: 'Vega is positive for both calls and puts (higher IV → higher option price). Long options benefit from IV increases (vega is positive). Short options are hurt by IV increases. Vega is highest for ATM options and longer expirations. Traders who expect a volatility spike will buy options before earnings; those expecting a calm market sell options.',
        formula: 'V = S · N\'(d₁) · √T / 100',
        example: 'Your option has Vega = 0.12. IV jumps from 25% to 30% (+5%) → option gains ~$0.60, even with no stock movement.' },
    ],
  },
  {
    category: 'personal',
    label: 'Personal Finance',
    color: '#4ade80',
    items: [
      { id: 'networth', title: 'Net Worth', icon: '💰',
        summary: 'The total value of what you own minus what you owe.',
        body: 'Net worth is the single most important number in personal finance. Assets include cash, investments, real estate, and vehicles. Liabilities include mortgages, student loans, credit card debt, and car loans. Growing your net worth over time — by earning more, saving more, investing, and reducing debt — is the foundation of financial health.',
        formula: 'Net Worth = Total Assets − Total Liabilities',
        example: 'You have $15,000 in savings, $30,000 in investments, and $8,000 in credit card debt → Net Worth = $37,000.' },
      { id: 'allocation', title: 'Asset Allocation', icon: '🥧',
        summary: 'How your money is split across different asset classes to balance risk and return.',
        body: 'The classic guideline: subtract your age from 110 to get your stock percentage (the rest in bonds). At 25: 85% stocks, 15% bonds. At 60: 50% stocks, 50% bonds. Stocks offer higher long-term returns but more volatility. Bonds are more stable but lower return. Cash provides safety but loses to inflation over time.',
        formula: 'Stock % ≈ 110 − Age (traditional rule of thumb)',
        example: 'A 30-year-old might hold 80% stocks (S&P 500 index fund), 15% bonds, 5% cash.' },
      { id: 'diversification', title: 'Diversification', icon: '🎲',
        summary: 'Spreading investments across assets so one loss doesn\'t sink your portfolio.',
        body: 'Diversification reduces unsystematic risk — the risk specific to one company or sector. A portfolio of 20–30 uncorrelated stocks eliminates most company-specific risk. Index funds provide instant diversification across hundreds or thousands of companies. Geographic diversification (international stocks) reduces country-specific risk.',
        formula: 'σ_portfolio < average(σ_individual) when correlations < 1',
        example: 'Holding only one tech stock is high risk. Holding an S&P 500 index fund means one company\'s bankruptcy barely moves your portfolio.' },
      { id: '503020', title: '50/30/20 Rule', icon: '📊',
        summary: 'A simple budgeting framework: 50% needs, 30% wants, 20% savings.',
        body: 'Needs (50%): rent, utilities, groceries, minimum debt payments. Wants (30%): dining out, subscriptions, entertainment, travel. Savings/Debt (20%): emergency fund, retirement (401k/IRA), investments, extra debt payoff. The framework is a starting point — high cost-of-living cities may require 60%+ on needs.',
        formula: 'Savings Rate = (Income − Expenses) / Income × 100',
        example: 'Income: $5,000/month → $2,500 needs, $1,500 wants, $1,000 savings/investing.' },
      { id: 'emergency', title: 'Emergency Fund', icon: '🛡️',
        summary: '3–6 months of expenses in liquid savings as a financial safety net.',
        body: 'An emergency fund prevents you from going into debt when unexpected expenses arise — job loss, medical bills, car repairs. Keep it in a high-yield savings account (HYSA) earning 4–5% APY, not invested in stocks. Once funded, don\'t touch it except for true emergencies. Salaried employees need 3 months; freelancers/variable income need 6+.',
        formula: 'Target = Monthly Expenses × 3 to 6',
        example: 'Monthly expenses of $3,500 → Emergency fund target: $10,500 to $21,000.' },
      { id: 'compound', title: 'Compound Interest', icon: '🔁',
        summary: 'Earning returns on your returns — the most powerful force in personal finance.',
        body: 'Einstein allegedly called compound interest the "eighth wonder of the world." Starting early matters enormously: $10,000 invested at 25 grows to ~$217,000 by 65 at 8% annual return. The same $10,000 invested at 35 grows to only ~$100,000. Time in the market beats timing the market.',
        formula: 'A = P(1 + r/n)^(nt)',
        example: '$500/month from age 25 at 8% → $1.74M at 65. Starting at 35 → only $745K. The 10-year delay costs ~$1M.' },
    ],
  },
];

export default function Dashboard() {
  const [panel, setPanel] = useState('overview');
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [holdings, setHoldings] = useState([]);
  const [budget, setBudget] = useState([]);
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [snapshots, setSnapshots] = useState([]);
  const [budgetLimits, setBudgetLimits] = useState({});
  const [editingLimit, setEditingLimit] = useState(null);
  const [limitInput, setLimitInput] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [goals, setGoals] = useState([]);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const [goalForm, setGoalForm] = useState({ name: '', target: '', accountId: '' });
  const [tickerFilter, setTickerFilter] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatBottomRef = useRef(null);
  const [fearGreed, setFearGreed] = useState(null);
  const [adviceState, setAdviceState] = useState({});
  const [marketTickers, setMarketTickers] = useState({ indices: [], active: [] });
  const [sp500Candles, setSp500Candles] = useState([]);
  const [sp500Period, setSp500Period] = useState('3mo');
  const [learnCategory, setLearnCategory] = useState('markets');
  const [learnExpanded, setLearnExpanded] = useState(new Set());

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [acc, tellerAcc, txns, tellerTxns, hold, news, snaps, limits, goalsRes, marketRes, tickersRes, sp500Res] = await Promise.allSettled([
        api.get('/plaid/accounts'),
        api.get('/teller/accounts'),
        api.get('/transactions'),
        api.get('/teller/transactions'),
        api.get('/investments/holdings'),
        api.get('/news'),
        api.get('/snapshots'),
        api.get('/budget/limits'),
        api.get('/goals'),
        api.get('/market/fear-greed'),
        api.get('/market/tickers'),
        api.get('/market/sp500', { params: { period: '3mo' } }),
      ]);

      const plaidAccounts = acc.status       === 'fulfilled' ? acc.value.data.accounts            || [] : [];
      const tAccounts     = tellerAcc.status === 'fulfilled' ? tellerAcc.value.data.accounts      || [] : [];
      const allAccounts   = [...plaidAccounts, ...tAccounts];
      setAccounts(allAccounts);

      const plaidTxns = txns.status       === 'fulfilled' ? txns.value.data.transactions      || [] : [];
      const tTxns     = tellerTxns.status === 'fulfilled' ? tellerTxns.value.data.transactions || [] : [];
      const allTxns   = [...plaidTxns, ...tTxns].sort((a, b) => new Date(b.date) - new Date(a.date));
      setTransactions(allTxns);

      // Compute budget from all transactions (month-to-date debits only)
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const byCategory = {};
      allTxns
        .filter(t => t.amount > 0 && new Date(t.date) >= monthStart)
        .forEach(t => {
          const cat = t.personal_finance_category?.primary || t.category?.[0] || 'Other';
          byCategory[cat] = (byCategory[cat] || 0) + t.amount;
        });
      const budgetData = Object.entries(byCategory)
        .map(([category, total]) => ({ category, total: Math.round(total * 100) / 100 }))
        .sort((a, b) => b.total - a.total);
      setBudget(budgetData);

      const allHoldings = hold.status === 'fulfilled' ? hold.value.data.holdings || [] : [];
      setHoldings(allHoldings);
      if (news.status  === 'fulfilled') setArticles(news.value.data.articles || []);
      if (snaps.status === 'fulfilled') setSnapshots(snaps.value.data.snapshots || []);
      if (limits.status   === 'fulfilled') setBudgetLimits(limits.value.data.limits   || {});
      if (goalsRes.status === 'fulfilled') setGoals(goalsRes.value.data.goals         || []);
      if (marketRes.status   === 'fulfilled') setFearGreed(marketRes.value.data);
      if (tickersRes.status  === 'fulfilled') setMarketTickers(tickersRes.value.data);
      if (sp500Res.status    === 'fulfilled') setSp500Candles(sp500Res.value.data.candles || []);

      // Record today's net worth snapshot
      const cash      = allAccounts.reduce((s, a) => s + (a.balances?.current || 0), 0);
      const portfolio = allHoldings.reduce((s, h) => s + ((h.quantity || 0) * (h.institution_price || 0)), 0);
      const nw = cash + portfolio;
      if (nw > 0) {
        api.post('/snapshots', { netWorth: nw }).catch(() => {});
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const fetchNews = useCallback(async (tickers) => {
    try {
      const r = await api.get('/news', { params: tickers ? { tickers } : {} });
      setArticles(r.data.articles || []);
    } catch (err) {
      console.error('News fetch error:', err);
    }
  }, []);

  const fetchSP500 = useCallback(async (period) => {
    setSp500Period(period);
    try {
      const r = await api.get('/market/sp500', { params: { period } });
      setSp500Candles(r.data.candles || []);
    } catch { /* silent */ }
  }, []);

  const saveLimit = useCallback(async (category, value) => {
    try {
      const res = await api.post('/budget/limits', { category, limit: value === '' ? null : value });
      setBudgetLimits(res.data.limits);
    } catch (err) {
      console.error('Save limit error:', err);
    }
    setEditingLimit(null);
    setLimitInput('');
  }, []);

  const getAdvice = useCallback(async (panelKey) => {
    setAdviceState(s => ({ ...s, [panelKey]: { loading: true, text: '' } }));
    const prompts = {
      overview:    'Give me a concise 3–4 bullet financial health summary and top recommendations based on my accounts, spending, and portfolio.',
      banking:     'Analyze my recent transactions and account balances. Give me 3 specific, actionable recommendations to improve my cash management.',
      investments: 'Review my investment portfolio. Give me 3 specific insights or recommendations about my investment strategy and diversification.',
      budgeting:   'Review my spending by category. Give me 3 actionable recommendations to cut spending or improve my budget this month.',
    };
    try {
      const budgetMap = {};
      budget.forEach(b => { budgetMap[b.category] = { spent: b.total, limit: budgetLimits[b.category] }; });
      const slimAccounts = accounts.map(a => ({ name: a.name, type: a.type, balance: a.balances?.current ?? a.balance }));
      const slimTxns = transactions.slice(0, 40).map(t => ({ date: t.date, name: t.merchant_name || t.name, amount: t.amount, category: t.personal_finance_category?.primary || t.category?.[0] }));
      const slimHoldings = holdings.map(h => ({ name: h.security?.name || h.name, ticker: h.security?.ticker_symbol || h.ticker_symbol, value: (h.quantity || 0) * (h.institution_price || 0) }));
      const res = await api.post('/chat', {
        message: prompts[panelKey] || 'Give me financial recommendations based on my data.',
        history: [],
        context: { accounts: slimAccounts, transactions: slimTxns, holdings: slimHoldings, budget: budgetMap },
      });
      setAdviceState(s => ({ ...s, [panelKey]: { loading: false, text: res.data.reply } }));
    } catch {
      setAdviceState(s => ({ ...s, [panelKey]: { loading: false, text: 'Could not get advice. Check GROQ_API_KEY in backend .env.' } }));
    }
  }, [accounts, transactions, holdings, budget, budgetLimits]);

  const totalCash      = accounts.filter(a => !a.closed).reduce((s, a) => s + (a.balances?.current || 0), 0);
  const totalPortfolio = holdings.reduce((s, h) => s + ((h.quantity || 0) * (h.institution_price || 0)), 0);
  const netWorth       = totalCash + totalPortfolio;
  const monthlySpend   = budget.reduce((s, b) => s + b.total, 0);

  const sendMessage = useCallback(async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;
    const userMsg = { role: 'user', content: text };
    const newHistory = [...chatMessages, userMsg];
    setChatMessages(newHistory);
    setChatInput('');
    setChatLoading(true);
    try {
      const budgetMap = {};
      budget.forEach(b => { budgetMap[b.category] = { spent: b.total, limit: budgetLimits[b.category] }; });
      const slimAccounts = accounts.map(a => ({ name: a.name, type: a.type, subtype: a.subtype, balance: a.balances?.current ?? a.balance }));
      const slimTxns     = transactions.slice(0, 40).map(t => ({ date: t.date, name: t.merchant_name || t.name, amount: t.amount, category: t.personal_finance_category?.primary || t.category?.[0] }));
      const slimHoldings = holdings.map(h => ({ name: h.security?.name || h.name, ticker: h.security?.ticker_symbol || h.ticker_symbol, quantity: h.quantity, price: h.institution_price, value: (h.quantity || 0) * (h.institution_price || 0) }));
      const res = await api.post('/chat', {
        message: text,
        history: chatMessages.map(m => ({ role: m.role, content: m.content })),
        context: { accounts: slimAccounts, transactions: slimTxns, holdings: slimHoldings, budget: budgetMap },
      });
      setChatMessages([...newHistory, { role: 'assistant', content: res.data.reply }]);
    } catch {
      setChatMessages([...newHistory, { role: 'assistant', content: 'Sorry, couldn\'t get a response. Check GROQ_API_KEY in backend .env.' }]);
    } finally {
      setChatLoading(false);
    }
  }, [chatInput, chatLoading, chatMessages, accounts, transactions, holdings, budget, budgetLimits]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatLoading]);

  const navBtn = (key, label, icon) => (
    <button
      key={key}
      onClick={() => setPanel(key)}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 20px', border: 'none',
        background: panel === key ? '#1a2744' : 'transparent',
        color: panel === key ? BLUE : TEXT2,
        fontWeight: panel === key ? 600 : 400,
        cursor: 'pointer', fontSize: 14, textAlign: 'left',
        borderLeft: `3px solid ${panel === key ? BLUE : 'transparent'}`,
      }}
    >
      <span style={{ fontSize: 15, lineHeight: 1 }}>{icon}</span>
      {label}
    </button>
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: BG, fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: 14, color: TEXT }}>

      {/* ── SIDEBAR ─────────────────────────────────────── */}
      <aside style={{ width: 220, flexShrink: 0, background: SIDE_BG, borderRight: BORDER, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '24px 20px 20px', borderBottom: BORDER }}>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.5px', color: TEXT }}>Ledger</div>
          <div style={{ fontSize: 12, color: TEXT2, marginTop: 2 }}>Finance OS</div>
        </div>
        <nav style={{ flex: 1, paddingTop: 12 }}>
          {NAV.map(({ key, label, icon }) => navBtn(key, label, icon))}
        </nav>
        <div style={{ padding: 16, borderTop: BORDER, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <PlaidLink onSuccess={fetchAll} />
          <TellerConnect onSuccess={fetchAll} />
        </div>
      </aside>

      {/* ── MAIN CONTENT ────────────────────────────────── */}
      <main style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        <TickerBar indices={marketTickers.indices} active={marketTickers.active} />
        <div style={{ flex: 1, padding: 32 }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: TEXT2 }}>
            Syncing your accounts...
          </div>
        ) : (
          <>
            <style>{`
              @keyframes bounce {
                0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
                30% { transform: translateY(-5px); opacity: 1; }
              }
              @keyframes ticker-move {
                from { transform: translateX(0); }
                to   { transform: translateX(-50%); }
              }
              .ticker-scroll {
                display: flex;
                align-items: center;
                padding: 0 24px;
                animation: ticker-move 55s linear infinite;
                will-change: transform;
              }
              .ticker-scroll:hover { animation-play-state: paused; }
              .lc { transition: border-color 0.15s ease, box-shadow 0.15s ease; }
              .lc:hover { border-color: #3d3d3d !important; box-shadow: 0 4px 22px rgba(0,0,0,0.45); }
              .lr { transition: background 0.1s; }
              .lr:hover td { background: rgba(255,255,255,0.04); }
              button { transition: opacity 0.15s, transform 0.1s; }
              button:hover:not(:disabled) { opacity: 0.88; }
              button:active:not(:disabled) { transform: scale(0.97); }
            `}</style>

            {/* ── OVERVIEW ──────────────────────────────── */}
            {panel === 'overview' && (
              <div>
                <h1 style={{ margin: '0 0 24px', fontSize: 22, fontWeight: 700 }}>Overview</h1>
                <AdviceBox onGetAdvice={() => getAdvice('overview')} loading={adviceState.overview?.loading} text={adviceState.overview?.text} />

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24, marginTop: 24 }}>
                  {[
                    { label: 'Net Worth',       value: fmt(netWorth),       sub: 'Cash + Portfolio' },
                    { label: 'Cash & Deposits', value: fmt(totalCash),      sub: `${accounts.length} account${accounts.length !== 1 ? 's' : ''}` },
                    { label: 'Portfolio Value', value: fmt(totalPortfolio), sub: `${holdings.length} position${holdings.length !== 1 ? 's' : ''}` },
                  ].map(({ label, value, sub }) => (
                    <div key={label} className="lc" style={CARD}>
                      <div style={{ fontSize: 11, color: TEXT2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px' }}>{label}</div>
                      <div style={{ fontSize: 30, fontWeight: 700, margin: '8px 0 4px', letterSpacing: '-1px' }}>{value}</div>
                      <div style={{ fontSize: 12, color: TEXT2 }}>{sub}</div>
                    </div>
                  ))}
                </div>

                <div className="lc" style={{ ...CARD, marginBottom: 24 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 13, color: TEXT2, textTransform: 'uppercase', letterSpacing: '0.5px' }}>S&P 500</div>
                  <SP500Chart candles={sp500Candles} period={sp500Period} onPeriodChange={fetchSP500} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 24 }}>
                  <div className="lc" style={CARD}>
                    <div style={{ fontWeight: 600, marginBottom: 16 }}>Net Worth History</div>
                    <NetWorthChart snapshots={snapshots} />
                  </div>
                  <div className="lc" style={CARD}>
                    <div style={{ fontSize: 11, color: TEXT2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 10 }}>Market Sentiment</div>
                    {fearGreed ? (
                      <FearGreedGauge score={fearGreed.score} rating={fearGreed.rating} />
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 110, color: TEXT2, fontSize: 12 }}>Loading…</div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 16 }}>
                  <div className="lc" style={CARD}>
                    <div style={{ fontWeight: 600, marginBottom: 16 }}>Recent Transactions</div>
                    {transactions.length === 0 ? (
                      <div style={{ color: TEXT2, textAlign: 'center', padding: 24 }}>No transactions yet</div>
                    ) : transactions.slice(0, 8).map((t, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < 7 ? `1px solid ${BORDER_C}` : 'none' }}>
                        <div>
                          <div style={{ fontWeight: 500 }}>{t.merchant_name || t.name}</div>
                          <div style={{ fontSize: 12, color: TEXT2 }}>{fmtDate(t.date)} &middot; {t.personal_finance_category?.primary || t.category?.[0] || 'Other'}</div>
                        </div>
                        <div style={{ fontWeight: 600, color: t.amount > 0 ? RED : GREEN, fontFamily: 'monospace' }}>
                          {t.amount > 0 ? '−' : '+'}{fmt(Math.abs(t.amount))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="lc" style={CARD}>
                    <div style={{ fontWeight: 600, marginBottom: 16 }}>Market Alerts</div>
                    {articles.slice(0, 5).map((a, i) => (
                      <div key={i} style={{ padding: '10px 0', borderBottom: i < 4 ? `1px solid ${BORDER_C}` : 'none' }}>
                        <a href={a.url} target="_blank" rel="noreferrer" style={{ color: TEXT, textDecoration: 'none', fontSize: 13, fontWeight: 500, lineHeight: 1.4, display: 'block' }}>
                          {a.headline}
                        </a>
                        <div style={{ fontSize: 11, color: TEXT2, marginTop: 4 }}>
                          {a.source} &middot; {fmtDate(a.created_at)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── BANKING ───────────────────────────────── */}
            {panel === 'banking' && (
              <div>
                <h1 style={{ margin: '0 0 24px', fontSize: 22, fontWeight: 700 }}>Banking</h1>
                <AdviceBox onGetAdvice={() => getAdvice('banking')} loading={adviceState.banking?.loading} text={adviceState.banking?.text} />
                {accounts.length === 0 ? (
                  <div style={{ ...CARD, textAlign: 'center', padding: 48, color: TEXT2, marginBottom: 24, marginTop: 24 }}>
                    No accounts connected. Use the connect buttons in the sidebar.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24, marginTop: 24 }}>
                    {accounts.map(a => (
                      <div key={a.account_id} className="lc" style={{ ...CARD, opacity: a.closed ? 0.6 : 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ fontSize: 11, color: BLUE, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{a.institution_name}</div>
                          {a.closed && <span style={{ fontSize: 10, fontWeight: 700, color: TEXT3, background: MUTED, padding: '2px 7px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Closed</span>}
                        </div>
                        <div style={{ fontWeight: 600, margin: '6px 0 2px', fontSize: 15 }}>{a.name}</div>
                        <div style={{ fontSize: 28, fontWeight: 700, margin: '8px 0 4px', letterSpacing: '-0.5px', color: a.closed ? TEXT3 : TEXT }}>{a.closed ? '—' : fmt(a.balances?.current)}</div>
                        <div style={{ fontSize: 12, color: TEXT2, textTransform: 'capitalize' }}>{a.subtype}</div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="lc" style={CARD}>
                  <div style={{ fontWeight: 600, marginBottom: 16 }}>Transactions — Last 30 Days</div>
                  {transactions.length === 0 ? (
                    <div style={{ color: TEXT2, textAlign: 'center', padding: 24 }}>No transactions found</div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: BORDER }}>
                          {['Date', 'Merchant', 'Category', 'Amount'].map(h => (
                            <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Amount' ? 'right' : 'left', fontSize: 11, color: TEXT2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.map((t, i) => (
                          <tr key={i} className="lr" style={{ borderBottom: `1px solid ${BORDER_C}` }}>
                            <td style={{ padding: '10px 12px', color: TEXT2, fontSize: 13, whiteSpace: 'nowrap' }}>{fmtDate(t.date)}</td>
                            <td style={{ padding: '10px 12px', fontWeight: 500 }}>{t.merchant_name || t.name}</td>
                            <td style={{ padding: '10px 12px', color: TEXT2, fontSize: 13 }}>{t.personal_finance_category?.primary || t.category?.[0] || '—'}</td>
                            <td style={{ padding: '10px 12px', fontWeight: 600, color: t.amount > 0 ? RED : GREEN, textAlign: 'right', fontFamily: 'monospace' }}>
                              {t.amount > 0 ? '−' : '+'}{fmt(Math.abs(t.amount))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* ── INVESTMENTS ───────────────────────────── */}
            {panel === 'investments' && (
              <div>
                <h1 style={{ margin: '0 0 24px', fontSize: 22, fontWeight: 700 }}>Investments</h1>
                <AdviceBox onGetAdvice={() => getAdvice('investments')} loading={adviceState.investments?.loading} text={adviceState.investments?.text} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24, marginTop: 24 }}>
                  {[
                    { label: 'Portfolio Value', value: fmt(totalPortfolio) },
                    { label: 'Positions',        value: holdings.length },
                    { label: 'Avg Position',     value: holdings.length ? fmt(totalPortfolio / holdings.length) : '—' },
                  ].map(({ label, value }) => (
                    <div key={label} className="lc" style={CARD}>
                      <div style={{ fontSize: 11, color: TEXT2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px' }}>{label}</div>
                      <div style={{ fontSize: 30, fontWeight: 700, marginTop: 8, letterSpacing: '-0.5px' }}>{value}</div>
                    </div>
                  ))}
                </div>
                <div className="lc" style={CARD}>
                  <div style={{ fontWeight: 600, marginBottom: 16 }}>Holdings</div>
                  {holdings.length === 0 ? (
                    <div style={{ color: TEXT2, textAlign: 'center', padding: 24 }}>No holdings found. Connect an investment account via Plaid.</div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: BORDER }}>
                          {['Ticker', 'Name', 'Shares', 'Price', 'Value', 'P&L'].map(h => (
                            <th key={h} style={{ padding: '8px 12px', textAlign: ['Shares', 'Price', 'Value', 'P&L'].includes(h) ? 'right' : 'left', fontSize: 11, color: TEXT2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {holdings.map((h, i) => {
                          const ticker = h.security?.ticker_symbol || '—';
                          const name   = h.security?.name || '—';
                          const qty    = h.quantity || 0;
                          const price  = h.institution_price || 0;
                          const value  = qty * price;
                          const cost   = h.cost_basis || 0;
                          const pnl    = cost > 0 ? value - cost : null;
                          return (
                            <tr key={i} className="lr" style={{ borderBottom: `1px solid ${BORDER_C}` }}>
                              <td style={{ padding: '10px 12px', fontWeight: 700, color: BLUE, fontSize: 13 }}>{ticker}</td>
                              <td style={{ padding: '10px 12px', fontSize: 13, color: TEXT2, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</td>
                              <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontSize: 13 }}>{qty.toFixed(4)}</td>
                              <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontSize: 13 }}>{fmt(price)}</td>
                              <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, fontFamily: 'monospace' }}>{fmt(value)}</td>
                              <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontSize: 13, color: pnl === null ? TEXT3 : pnl >= 0 ? GREEN : RED }}>
                                {pnl === null ? '—' : `${pnl >= 0 ? '+' : ''}${fmt(pnl)}`}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
                <OptionsChain />
              </div>
            )}

            {/* ── BUDGETING ─────────────────────────────── */}
            {panel === 'budgeting' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                  {selectedCategory && (
                    <button onClick={() => setSelectedCategory(null)} style={{ background: MUTED, border: BORDER, borderRadius: 6, color: TEXT2, padding: '6px 12px', cursor: 'pointer', fontSize: 13 }}>
                      ← Back
                    </button>
                  )}
                  <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
                    {selectedCategory ? selectedCategory.replace(/_/g, ' ').toLowerCase() : 'Budgeting'}
                  </h1>
                </div>

                {!selectedCategory ? (
                  <>
                    <AdviceBox onGetAdvice={() => getAdvice('budgeting')} loading={adviceState.budgeting?.loading} text={adviceState.budgeting?.text} />
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24, marginTop: 24 }}>
                      {[
                        { label: 'Month-to-Date Spend', value: fmt(monthlySpend) },
                        { label: 'Top Category',         value: budget[0]?.category?.replace(/_/g, ' ') || '—' },
                        { label: 'Categories Tracked',   value: budget.length },
                      ].map(({ label, value }) => (
                        <div key={label} className="lc" style={CARD}>
                          <div style={{ fontSize: 11, color: TEXT2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px' }}>{label}</div>
                          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 8, letterSpacing: '-0.5px' }}>{value}</div>
                        </div>
                      ))}
                    </div>

                    <div className="lc" style={CARD}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                        <div style={{ fontWeight: 600 }}>Spending by Category — This Month</div>
                        <div style={{ fontSize: 12, color: TEXT2 }}>Click name to see transactions · Click amount to set limit</div>
                      </div>

                      {budget.length === 0 ? (
                        <div style={{ color: TEXT2, textAlign: 'center', padding: 24 }}>No budget data. Connect accounts to see spending.</div>
                      ) : budget.map((b, i) => {
                        const limit = budgetLimits[b.category];
                        const pct   = limit ? Math.min((b.total / limit) * 100, 100) : null;
                        const over  = limit && b.total > limit;
                        const warn  = limit && pct >= 80 && !over;
                        const barColor = over ? RED : warn ? YELLOW : BLUE_BTN;
                        const isEditing = editingLimit === b.category;

                        return (
                          <div key={i} style={{ marginBottom: 20 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                              <button
                                onClick={() => { setSelectedCategory(b.category); setEditingLimit(null); }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}
                              >
                                <span style={{ fontSize: 13, fontWeight: 500, textTransform: 'capitalize', color: TEXT }}>
                                  {b.category.replace(/_/g, ' ').toLowerCase()}
                                </span>
                                <span style={{ fontSize: 11, color: TEXT3, marginLeft: 8 }}>
                                  {limit && !isEditing ? `limit: ${fmt(limit)}` : !isEditing ? '+ set limit' : ''}
                                </span>
                              </button>

                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                {isEditing ? (
                                  <>
                                    <input
                                      autoFocus
                                      value={limitInput}
                                      onChange={e => setLimitInput(e.target.value)}
                                      onKeyDown={e => {
                                        if (e.key === 'Enter') saveLimit(b.category, limitInput);
                                        if (e.key === 'Escape') { setEditingLimit(null); setLimitInput(''); }
                                      }}
                                      placeholder="Monthly limit $"
                                      style={{ width: 130, padding: '4px 8px', background: MUTED, border: BORDER, borderRadius: 6, color: TEXT, fontSize: 12, outline: 'none' }}
                                    />
                                    <button onClick={() => saveLimit(b.category, limitInput)} style={{ padding: '4px 10px', background: BLUE_BTN, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>Save</button>
                                    {limit && <button onClick={() => saveLimit(b.category, '')} style={{ padding: '4px 8px', background: MUTED, color: RED, border: BORDER, borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>Remove</button>}
                                    <button onClick={() => { setEditingLimit(null); setLimitInput(''); }} style={{ padding: '4px 8px', background: 'none', color: TEXT2, border: 'none', cursor: 'pointer', fontSize: 12 }}>Cancel</button>
                                  </>
                                ) : (
                                  <button
                                    onClick={() => { setEditingLimit(b.category); setLimitInput(limit ? String(limit) : ''); }}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                                  >
                                    <span style={{ fontSize: 13, fontWeight: 600, fontFamily: 'monospace', color: over ? RED : TEXT }}>
                                      {fmt(b.total)}{limit ? ` / ${fmt(limit)}` : ''}
                                    </span>
                                  </button>
                                )}
                              </div>
                            </div>

                            <div style={{ height: 6, background: MUTED, borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${pct !== null ? pct : Math.min((b.total / (budget[0]?.total || 1)) * 100, 100)}%`, background: barColor, borderRadius: 3, transition: 'width 0.3s ease' }} />
                            </div>
                            {over && <div style={{ fontSize: 11, color: RED, marginTop: 4 }}>Over budget by {fmt(b.total - limit)}</div>}
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <>
                    {(() => {
                      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
                      const catTxns = transactions.filter(t => {
                        const cat = t.personal_finance_category?.primary || t.category?.[0] || 'Other';
                        return cat === selectedCategory && t.amount > 0 && new Date(t.date) >= monthStart;
                      });
                      const total = catTxns.reduce((s, t) => s + t.amount, 0);
                      const limit = budgetLimits[selectedCategory];
                      return (
                        <>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
                            {[
                              { label: 'Total Spent', value: fmt(total) },
                              { label: 'Transactions', value: catTxns.length },
                              { label: 'Budget Limit', value: limit ? fmt(limit) : 'Not set' },
                            ].map(({ label, value }) => (
                              <div key={label} className="lc" style={CARD}>
                                <div style={{ fontSize: 11, color: TEXT2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px' }}>{label}</div>
                                <div style={{ fontSize: 28, fontWeight: 700, marginTop: 8, letterSpacing: '-0.5px' }}>{value}</div>
                              </div>
                            ))}
                          </div>
                          <div className="lc" style={CARD}>
                            <div style={{ fontWeight: 600, marginBottom: 16 }}>Transactions this month</div>
                            {catTxns.length === 0 ? (
                              <div style={{ color: TEXT2, textAlign: 'center', padding: 24 }}>No transactions this month</div>
                            ) : catTxns.map((t, i) => (
                              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < catTxns.length - 1 ? `1px solid ${BORDER_C}` : 'none' }}>
                                <div>
                                  <div style={{ fontWeight: 500 }}>{t.merchant_name || t.name}</div>
                                  <div style={{ fontSize: 12, color: TEXT2 }}>{fmtDate(t.date)}</div>
                                </div>
                                <div style={{ fontWeight: 600, color: RED, fontFamily: 'monospace' }}>
                                  −{fmt(Math.abs(t.amount))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      );
                    })()}
                  </>
                )}
              </div>
            )}

            {/* ── TRENDS ───────────────────────────────── */}
            {panel === 'trends' && (() => {
              const now = new Date();
              const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
              const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
              const lastMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0);

              const inRange = (t, from, to) => {
                const d = new Date(t.date);
                return d >= from && d <= to;
              };

              const thisTxns = transactions.filter(t => inRange(t, thisMonthStart, now));
              const lastTxns = transactions.filter(t => inRange(t, lastMonthStart, lastMonthEnd));

              // Cash flow helpers
              const income   = txns => txns.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
              const expenses = txns => txns.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);

              const thisIncome   = income(thisTxns);
              const thisExpenses = expenses(thisTxns);
              const lastIncome   = income(lastTxns);
              const lastExpenses = expenses(lastTxns);
              const thisNet = thisIncome - thisExpenses;
              const lastNet = lastIncome - lastExpenses;

              const cashFlowMax = Math.max(thisIncome, thisExpenses, lastIncome, lastExpenses, 1);

              // Spending trends by category
              const catSpend = (txns) => {
                const map = {};
                txns.filter(t => t.amount > 0).forEach(t => {
                  const cat = t.personal_finance_category?.primary || t.category?.[0] || 'Other';
                  map[cat] = (map[cat] || 0) + t.amount;
                });
                return map;
              };
              const thisSpend = catSpend(thisTxns);
              const lastSpend = catSpend(lastTxns);
              const allCats = [...new Set([...Object.keys(thisSpend), ...Object.keys(lastSpend)])]
                .sort((a, b) => (thisSpend[b] || 0) - (thisSpend[a] || 0));

              const thisMonthLabel = now.toLocaleDateString('en-US', { month: 'long' });
              const lastMonthLabel = new Date(now.getFullYear(), now.getMonth() - 1).toLocaleDateString('en-US', { month: 'long' });

              return (
                <div>
                  <h1 style={{ margin: '0 0 24px', fontSize: 22, fontWeight: 700 }}>Trends</h1>

                  {/* ── Cash Flow ── */}
                  <div style={{ ...CARD, marginBottom: 24 }}>
                    <div style={{ fontWeight: 600, marginBottom: 20 }}>Cash Flow</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
                      {[
                        { label: thisMonthLabel, inc: thisIncome, exp: thisExpenses, net: thisNet },
                        { label: lastMonthLabel, inc: lastIncome, exp: lastExpenses, net: lastNet },
                      ].map(({ label, inc, exp, net }) => (
                        <div key={label}>
                          <div style={{ fontSize: 12, color: TEXT2, fontWeight: 600, marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>

                          {[{ val: inc, color: GREEN, lbl: 'Income' }, { val: exp, color: RED, lbl: 'Expenses' }].map(({ val, color, lbl }) => (
                            <div key={lbl} style={{ marginBottom: 12 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                                <span style={{ fontSize: 12, color: TEXT2 }}>{lbl}</span>
                                <span style={{ fontSize: 13, fontWeight: 600, fontFamily: 'monospace', color }}>{fmt(val)}</span>
                              </div>
                              <div style={{ height: 8, background: MUTED, borderRadius: 4, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${(val / cashFlowMax) * 100}%`, background: color, borderRadius: 4, transition: 'width 0.4s ease' }} />
                              </div>
                            </div>
                          ))}

                          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 10, borderTop: BORDER, marginTop: 4 }}>
                            <span style={{ fontSize: 12, color: TEXT2 }}>Net</span>
                            <span style={{ fontSize: 14, fontWeight: 700, fontFamily: 'monospace', color: net >= 0 ? GREEN : RED }}>
                              {net >= 0 ? '+' : ''}{fmt(net)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ── Spending Trends ── */}
                  <div className="lc" style={CARD}>
                    <div style={{ fontWeight: 600, marginBottom: 20 }}>
                      Spending by Category — {lastMonthLabel} vs {thisMonthLabel}
                    </div>
                    {allCats.length === 0 ? (
                      <div style={{ color: TEXT2, textAlign: 'center', padding: 24 }}>Not enough transaction history yet</div>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom: BORDER }}>
                            <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, color: TEXT2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Category</th>
                            <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 11, color: TEXT2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{lastMonthLabel}</th>
                            <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 11, color: TEXT2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{thisMonthLabel}</th>
                            <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 11, color: TEXT2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Change</th>
                          </tr>
                        </thead>
                        <tbody>
                          {allCats.map((cat, i) => {
                            const last = lastSpend[cat] || 0;
                            const curr = thisSpend[cat] || 0;
                            const diff = curr - last;
                            const pct  = last > 0 ? ((diff / last) * 100) : null;
                            const changeColor = diff > 0 ? RED : diff < 0 ? GREEN : TEXT2;
                            return (
                              <tr key={cat} className="lr" style={{ borderBottom: `1px solid ${BORDER_C}` }}>
                                <td style={{ padding: '11px 12px', fontWeight: 500, textTransform: 'capitalize', fontSize: 13 }}>
                                  {cat.replace(/_/g, ' ').toLowerCase()}
                                </td>
                                <td style={{ padding: '11px 12px', textAlign: 'right', fontFamily: 'monospace', fontSize: 13, color: TEXT2 }}>{last > 0 ? fmt(last) : '—'}</td>
                                <td style={{ padding: '11px 12px', textAlign: 'right', fontFamily: 'monospace', fontSize: 13 }}>{curr > 0 ? fmt(curr) : '—'}</td>
                                <td style={{ padding: '11px 12px', textAlign: 'right', fontFamily: 'monospace', fontSize: 13, fontWeight: 600, color: changeColor }}>
                                  {diff === 0 ? '—' : `${diff > 0 ? '+' : ''}${fmt(Math.abs(diff))}`}
                                  {pct !== null && <span style={{ fontSize: 11, marginLeft: 5, opacity: 0.7 }}>({pct > 0 ? '+' : ''}{pct.toFixed(0)}%)</span>}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* ── SUBSCRIPTIONS ────────────────────────── */}
            {panel === 'subscriptions' && (() => {
              // Group debits by normalized merchant name
              const groups = {};
              transactions
                .filter(t => t.amount > 0)
                .forEach(t => {
                  const key = (t.merchant_name || t.name || '').toLowerCase().trim();
                  if (!key) return;
                  if (!groups[key]) groups[key] = { name: t.merchant_name || t.name, txns: [] };
                  groups[key].txns.push(t);
                });

              const subs = [];
              Object.values(groups).forEach(({ name, txns }) => {
                if (txns.length < 2) return;
                const sorted = [...txns].sort((a, b) => new Date(a.date) - new Date(b.date));
                const amounts = sorted.map(t => t.amount);
                const avgAmt  = amounts.reduce((s, a) => s + a, 0) / amounts.length;
                // Reject if amounts vary more than 15%
                if (amounts.some(a => Math.abs(a - avgAmt) / avgAmt > 0.15)) return;

                // Calculate average gap in days between transactions
                const gaps = [];
                for (let i = 1; i < sorted.length; i++) {
                  gaps.push((new Date(sorted[i].date) - new Date(sorted[i - 1].date)) / (1000 * 60 * 60 * 24));
                }
                const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;
                // Reject if gaps vary wildly
                if (gaps.some(g => Math.abs(g - avgGap) > avgGap * 0.5)) return;

                let frequency, monthlyCost;
                if (avgGap >= 5 && avgGap <= 9) {
                  frequency = 'Weekly'; monthlyCost = avgAmt * 4.33;
                } else if (avgGap >= 12 && avgGap <= 18) {
                  frequency = 'Bi-weekly'; monthlyCost = avgAmt * 2.17;
                } else if (avgGap >= 26 && avgGap <= 40) {
                  frequency = 'Monthly'; monthlyCost = avgAmt;
                } else if (avgGap >= 85 && avgGap <= 100) {
                  frequency = 'Quarterly'; monthlyCost = avgAmt / 3;
                } else if (avgGap >= 340 && avgGap <= 390) {
                  frequency = 'Annual'; monthlyCost = avgAmt / 12;
                } else {
                  return;
                }

                const lastCharge = sorted[sorted.length - 1];
                subs.push({ name, avgAmt, frequency, monthlyCost, lastDate: lastCharge.date, count: txns.length });
              });

              subs.sort((a, b) => b.monthlyCost - a.monthlyCost);
              const totalMonthly = subs.reduce((s, sub) => s + sub.monthlyCost, 0);
              const totalAnnual  = totalMonthly * 12;

              return (
                <div>
                  <h1 style={{ margin: '0 0 24px', fontSize: 22, fontWeight: 700 }}>Subscriptions</h1>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
                    {[
                      { label: 'Monthly Cost',     value: fmt(totalMonthly) },
                      { label: 'Annual Cost',       value: fmt(totalAnnual) },
                      { label: 'Detected',          value: subs.length },
                    ].map(({ label, value }) => (
                      <div key={label} className="lc" style={CARD}>
                        <div style={{ fontSize: 11, color: TEXT2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px' }}>{label}</div>
                        <div style={{ fontSize: 28, fontWeight: 700, marginTop: 8, letterSpacing: '-0.5px' }}>{value}</div>
                      </div>
                    ))}
                  </div>

                  <div className="lc" style={CARD}>
                    <div style={{ fontWeight: 600, marginBottom: 20 }}>Recurring Charges</div>
                    {subs.length === 0 ? (
                      <div style={{ color: TEXT2, textAlign: 'center', padding: 32 }}>
                        No recurring charges detected yet. Check back once you have 90 days of transactions.
                      </div>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom: BORDER }}>
                            {['Merchant', 'Frequency', 'Per Charge', 'Monthly Cost', 'Last Charge'].map(h => (
                              <th key={h} style={{ padding: '8px 12px', textAlign: ['Per Charge', 'Monthly Cost'].includes(h) ? 'right' : 'left', fontSize: 11, color: TEXT2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {subs.map((sub, i) => (
                            <tr key={i} className="lr" style={{ borderBottom: `1px solid ${BORDER_C}` }}>
                              <td style={{ padding: '11px 12px', fontWeight: 500 }}>{sub.name}</td>
                              <td style={{ padding: '11px 12px' }}>
                                <span style={{ background: MUTED, color: TEXT2, padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>{sub.frequency}</span>
                              </td>
                              <td style={{ padding: '11px 12px', textAlign: 'right', fontFamily: 'monospace', fontSize: 13 }}>{fmt(sub.avgAmt)}</td>
                              <td style={{ padding: '11px 12px', textAlign: 'right', fontFamily: 'monospace', fontSize: 13, fontWeight: 600, color: RED }}>{fmt(sub.monthlyCost)}</td>
                              <td style={{ padding: '11px 12px', color: TEXT2, fontSize: 13 }}>{fmtDate(sub.lastDate)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    <div style={{ marginTop: 16, padding: '12px 16px', background: MUTED, borderRadius: 8, fontSize: 12, color: TEXT2 }}>
                      Detected by finding charges with consistent amounts recurring on a regular schedule over the last 90 days.
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ── GOALS ────────────────────────────────── */}
            {panel === 'goals' && (() => {
              const totalSaved  = goals.reduce((s, g) => {
                const acct = accounts.find(a => a.account_id === g.accountId);
                return s + (acct ? (acct.balances?.current || 0) : 0);
              }, 0);
              const totalTarget = goals.reduce((s, g) => s + g.target, 0);

              const saveGoal = async () => {
                if (!goalForm.name || !goalForm.target) return;
                try {
                  if (editingGoal) {
                    const res = await api.put(`/goals/${editingGoal.id}`, goalForm);
                    setGoals(prev => prev.map(g => g.id === editingGoal.id ? res.data.goal : g));
                  } else {
                    const res = await api.post('/goals', goalForm);
                    setGoals(prev => [...prev, res.data.goal]);
                  }
                  setShowGoalForm(false);
                  setEditingGoal(null);
                  setGoalForm({ name: '', target: '', accountId: '' });
                } catch (err) { console.error(err); }
              };

              const deleteGoal = async (id) => {
                await api.delete(`/goals/${id}`);
                setGoals(prev => prev.filter(g => g.id !== id));
              };

              const openEdit = (goal) => {
                setEditingGoal(goal);
                setGoalForm({ name: goal.name, target: String(goal.target), accountId: goal.accountId || '' });
                setShowGoalForm(true);
              };

              return (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                    <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Goals</h1>
                    <button
                      onClick={() => { setShowGoalForm(true); setEditingGoal(null); setGoalForm({ name: '', target: '', accountId: '' }); }}
                      style={{ padding: '8px 18px', background: BLUE_BTN, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
                    >
                      + New Goal
                    </button>
                  </div>

                  {/* Add / Edit form */}
                  {showGoalForm && (
                    <div style={{ ...CARD, marginBottom: 24 }}>
                      <div style={{ fontWeight: 600, marginBottom: 16 }}>{editingGoal ? 'Edit Goal' : 'New Goal'}</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                        <div>
                          <div style={{ fontSize: 11, color: TEXT2, marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Goal Name</div>
                          <input
                            value={goalForm.name}
                            onChange={e => setGoalForm(f => ({ ...f, name: e.target.value }))}
                            placeholder="e.g. Emergency Fund"
                            style={{ width: '100%', padding: '9px 12px', background: MUTED, border: BORDER, borderRadius: 8, color: TEXT, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                          />
                        </div>
                        <div>
                          <div style={{ fontSize: 11, color: TEXT2, marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Target Amount</div>
                          <input
                            value={goalForm.target}
                            onChange={e => setGoalForm(f => ({ ...f, target: e.target.value }))}
                            placeholder="e.g. 10000"
                            type="number"
                            style={{ width: '100%', padding: '9px 12px', background: MUTED, border: BORDER, borderRadius: 8, color: TEXT, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                          />
                        </div>
                        <div>
                          <div style={{ fontSize: 11, color: TEXT2, marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Track Account (optional)</div>
                          <select
                            value={goalForm.accountId}
                            onChange={e => setGoalForm(f => ({ ...f, accountId: e.target.value }))}
                            style={{ width: '100%', padding: '9px 12px', background: MUTED, border: BORDER, borderRadius: 8, color: goalForm.accountId ? TEXT : TEXT2, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                          >
                            <option value="">No account linked</option>
                            {accounts.map(a => (
                              <option key={a.account_id} value={a.account_id}>{a.name} ({fmt(a.balances?.current)})</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button onClick={saveGoal} style={{ padding: '8px 20px', background: BLUE_BTN, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                          {editingGoal ? 'Save Changes' : 'Create Goal'}
                        </button>
                        <button onClick={() => { setShowGoalForm(false); setEditingGoal(null); }} style={{ padding: '8px 16px', background: MUTED, color: TEXT2, border: BORDER, borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Summary cards */}
                  {goals.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
                      {[
                        { label: 'Total Saved',   value: fmt(totalSaved) },
                        { label: 'Total Target',  value: fmt(totalTarget) },
                        { label: 'Goals',         value: goals.length },
                      ].map(({ label, value }) => (
                        <div key={label} className="lc" style={CARD}>
                          <div style={{ fontSize: 11, color: TEXT2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px' }}>{label}</div>
                          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 8, letterSpacing: '-0.5px' }}>{value}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Goal cards */}
                  {goals.length === 0 && !showGoalForm ? (
                    <div style={{ ...CARD, textAlign: 'center', padding: 48, color: TEXT2 }}>
                      <div style={{ fontSize: 28, marginBottom: 12 }}>◎</div>
                      <div style={{ fontWeight: 600, marginBottom: 6, color: TEXT }}>No goals yet</div>
                      <div style={{ fontSize: 13 }}>Create a goal to track your progress toward a savings target.</div>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                      {goals.map(goal => {
                        const acct    = accounts.find(a => a.account_id === goal.accountId);
                        const current = acct ? (acct.balances?.current || 0) : 0;
                        const pct     = Math.min((current / goal.target) * 100, 100);
                        const done    = current >= goal.target;
                        const barColor = done ? GREEN : pct >= 75 ? BLUE : BLUE_BTN;

                        return (
                          <div key={goal.id} className="lc" style={CARD}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                              <div>
                                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{goal.name}</div>
                                {acct ? (
                                  <div style={{ fontSize: 12, color: TEXT2 }}>{acct.name} · {acct.institution_name}</div>
                                ) : (
                                  <div style={{ fontSize: 12, color: TEXT3 }}>No account linked</div>
                                )}
                              </div>
                              {done && <span style={{ background: '#14532d', color: GREEN, padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>Complete</span>}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                              <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px', color: done ? GREEN : TEXT }}>
                                {acct ? fmt(current) : '—'}
                              </span>
                              <span style={{ fontSize: 13, color: TEXT2 }}>of {fmt(goal.target)}</span>
                            </div>

                            <div style={{ height: 8, background: MUTED, borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
                              <div style={{ height: '100%', width: `${acct ? pct : 0}%`, background: barColor, borderRadius: 4, transition: 'width 0.4s ease' }} />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: 12, color: TEXT2 }}>
                                {acct ? `${pct.toFixed(0)}% · ${done ? 'Goal reached!' : fmt(goal.target - current) + ' to go'}` : 'Link an account to track progress'}
                              </span>
                              <div style={{ display: 'flex', gap: 8 }}>
                                <button onClick={() => openEdit(goal)} style={{ background: 'none', border: 'none', color: TEXT2, cursor: 'pointer', fontSize: 12, padding: '2px 6px' }}>Edit</button>
                                <button onClick={() => deleteGoal(goal.id)} style={{ background: 'none', border: 'none', color: RED, cursor: 'pointer', fontSize: 12, padding: '2px 6px' }}>Delete</button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── NEWS FEED ─────────────────────────────── */}
            {panel === 'news' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                  <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>News Feed</h1>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      value={tickerFilter}
                      onChange={e => setTickerFilter(e.target.value)}
                      placeholder="Filter: AAPL,NVDA,VTI"
                      style={{ padding: '8px 12px', border: BORDER, borderRadius: 6, fontSize: 13, width: 200, outline: 'none', background: MUTED, color: TEXT }}
                    />
                    <button onClick={() => fetchNews(tickerFilter || undefined)} style={{ padding: '8px 16px', background: BLUE_BTN, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                      Filter
                    </button>
                    {tickerFilter && (
                      <button onClick={() => { setTickerFilter(''); fetchNews(); }} style={{ padding: '8px 12px', background: MUTED, color: TEXT2, border: BORDER, borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
                        Clear
                      </button>
                    )}
                  </div>
                </div>
                {articles.length === 0 ? (
                  <div style={{ ...CARD, textAlign: 'center', padding: 48, color: TEXT2 }}>No articles found</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                    {articles.map((a, i) => (
                      <div key={i} className="lc" style={CARD}>
                        {(a.symbols?.length > 0) && (
                          <div style={{ display: 'flex', gap: 5, marginBottom: 10, flexWrap: 'wrap' }}>
                            {a.symbols.slice(0, 5).map(s => (
                              <span key={s} style={{ background: '#1a2744', color: BLUE, padding: '2px 7px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>{s}</span>
                            ))}
                          </div>
                        )}
                        <a href={a.url} target="_blank" rel="noreferrer" style={{ display: 'block', color: TEXT, textDecoration: 'none', fontWeight: 600, fontSize: 14, lineHeight: 1.45, marginBottom: a.summary ? 8 : 0 }}>
                          {a.headline}
                        </a>
                        {a.summary && (
                          <p style={{ margin: '0 0 10px', color: TEXT2, fontSize: 13, lineHeight: 1.5 }}>
                            {a.summary.length > 160 ? a.summary.slice(0, 160) + '…' : a.summary}
                          </p>
                        )}
                        <div style={{ fontSize: 11, color: TEXT3 }}>{a.source} &middot; {fmtDate(a.created_at)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── LEARN ────────────────────────────────── */}
            {panel === 'learn' && (() => {
              const section = LEARN_CONTENT.find(s => s.category === learnCategory);
              const toggleExpand = (id) => setLearnExpanded(prev => {
                const next = new Set(prev);
                next.has(id) ? next.delete(id) : next.add(id);
                return next;
              });
              return (
                <div>
                  <h1 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 700 }}>Learn</h1>
                  <p style={{ margin: '0 0 24px', color: TEXT2, fontSize: 14 }}>Financial concepts explained clearly — from market basics to options Greeks.</p>

                  {/* Category tabs */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 28, borderBottom: BORDER, paddingBottom: 16 }}>
                    {LEARN_CONTENT.map(s => (
                      <button key={s.category} onClick={() => { setLearnCategory(s.category); setLearnExpanded(new Set()); }}
                        style={{ padding: '8px 20px', borderRadius: 8, border: learnCategory === s.category ? `1px solid ${s.color}` : BORDER,
                          background: learnCategory === s.category ? `${s.color}18` : MUTED,
                          color: learnCategory === s.category ? s.color : TEXT2,
                          fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'all 0.15s' }}>
                        {s.label}
                      </button>
                    ))}
                  </div>

                  {/* Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                    {section?.items.map(item => {
                      const expanded = learnExpanded.has(item.id);
                      return (
                        <div key={item.id} className="lc" style={{ ...CARD, cursor: 'pointer', transition: 'all 0.2s' }}
                          onClick={() => toggleExpand(item.id)}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                              <span style={{ fontSize: 24 }}>{item.icon}</span>
                              <div>
                                <div style={{ fontWeight: 700, fontSize: 15 }}>{item.title}</div>
                                <div style={{ fontSize: 12, color: TEXT2, marginTop: 2 }}>{item.summary}</div>
                              </div>
                            </div>
                            <span style={{ color: TEXT3, fontSize: 18, marginLeft: 8, flexShrink: 0 }}>{expanded ? '−' : '+'}</span>
                          </div>

                          {expanded && (
                            <div style={{ marginTop: 16, borderTop: BORDER, paddingTop: 16 }} onClick={e => e.stopPropagation()}>
                              <p style={{ margin: '0 0 14px', fontSize: 13, lineHeight: 1.7, color: TEXT }}>{item.body}</p>
                              {item.formula && (
                                <div style={{ background: '#111', border: BORDER, borderRadius: 7, padding: '10px 14px', marginBottom: 14, fontFamily: 'monospace', fontSize: 13, color: section.color }}>
                                  {item.formula}
                                </div>
                              )}
                              <div style={{ background: '#0a1628', border: `1px solid #1a3a6b`, borderRadius: 7, padding: '10px 14px', fontSize: 12, lineHeight: 1.6, color: TEXT2 }}>
                                <span style={{ color: BLUE, fontWeight: 600 }}>Example: </span>{item.example}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* ── AI ASSISTANT ──────────────────────────── */}
            {panel === 'assistant' && (
              <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)' }}>
                <h1 style={{ margin: '0 0 16px', fontSize: 22, fontWeight: 700, flexShrink: 0 }}>AI Assistant</h1>
                <div style={{ ...CARD, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, padding: 0, overflow: 'hidden' }}>
                  <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {chatMessages.length === 0 && (
                      <div style={{ textAlign: 'center', color: TEXT2, marginTop: 60 }}>
                        <div style={{ fontSize: 32, marginBottom: 12 }}>✦</div>
                        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6, color: TEXT }}>Your AI Financial Advisor</div>
                        <div style={{ fontSize: 13 }}>Ask me about your spending, investments, budget, or anything in your accounts.</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 20 }}>
                          {[
                            'How much did I spend on food this month?',
                            "What's my biggest expense category?",
                            'Summarize my financial health',
                            'What are my account balances?',
                          ].map(q => (
                            <button key={q} onClick={() => setChatInput(q)} style={{ padding: '8px 14px', background: MUTED, border: BORDER, borderRadius: 20, fontSize: 12, cursor: 'pointer', color: TEXT2 }}>
                              {q}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {chatMessages.map((msg, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                        <div style={{
                          maxWidth: '72%', padding: '12px 16px',
                          borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                          background: msg.role === 'user' ? BLUE_BTN : MUTED,
                          color: msg.role === 'user' ? '#fff' : TEXT,
                          fontSize: 14, lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                        }}>
                          {msg.content}
                        </div>
                      </div>
                    ))}
                    {chatLoading && (
                      <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                        <div style={{ padding: '12px 16px', borderRadius: '18px 18px 18px 4px', background: MUTED, display: 'flex', gap: 5, alignItems: 'center' }}>
                          {[0, 1, 2].map(j => (
                            <div key={j} style={{ width: 7, height: 7, borderRadius: '50%', background: TEXT2, animation: 'bounce 1.2s ease-in-out infinite', animationDelay: `${j * 0.2}s` }} />
                          ))}
                        </div>
                      </div>
                    )}
                    <div ref={chatBottomRef} />
                  </div>
                  <div style={{ padding: '16px 24px', borderTop: BORDER, display: 'flex', gap: 10, flexShrink: 0 }}>
                    <input
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                      placeholder="Ask anything about your finances…"
                      style={{ flex: 1, padding: '12px 16px', border: BORDER, borderRadius: 24, fontSize: 14, outline: 'none', background: MUTED, color: TEXT }}
                    />
                    <button
                      onClick={sendMessage}
                      disabled={!chatInput.trim() || chatLoading}
                      style={{
                        width: 44, height: 44, borderRadius: '50%', border: 'none',
                        background: chatInput.trim() && !chatLoading ? BLUE_BTN : MUTED,
                        color: chatInput.trim() && !chatLoading ? '#fff' : TEXT3,
                        cursor: chatInput.trim() && !chatLoading ? 'pointer' : 'default',
                        fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'background 0.15s', flexShrink: 0,
                      }}
                    >
                      ↑
                    </button>
                  </div>
                </div>
              </div>
            )}

          </>
        )}
        </div>
      </main>
    </div>
  );
}
