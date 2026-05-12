import React, { useState, useEffect, useRef } from 'react';
import api from '../../services/api';

// ── Institution registry ─────────────────────────────────────────────────────
// aggregator: 'plaid' | 'akoya' | 'mr_cooper' | 'yodlee' | 'manual'
// plaid_id: Plaid production institution_id (pre-selects institution in Link)
const INSTITUTIONS = [
  // ── Popular ────────────────────────────────────────────────────────────────
  { id: 'chase',       name: 'Chase',            domain: 'chase.com',           category: 'bank',       aggregator: 'plaid', plaid_id: 'ins_56'     },
  { id: 'bofa',        name: 'Bank of America',  domain: 'bankofamerica.com',   category: 'bank',       aggregator: 'plaid', plaid_id: 'ins_3'      },
  { id: 'wells',       name: 'Wells Fargo',      domain: 'wellsfargo.com',      category: 'bank',       aggregator: 'plaid', plaid_id: 'ins_4'      },
  { id: 'capone',      name: 'Capital One',      domain: 'capitalone.com',      category: 'bank',       aggregator: 'plaid', plaid_id: 'ins_9'      },
  { id: 'fidelity',    name: 'Fidelity',         domain: 'fidelity.com',        category: 'brokerage',  aggregator: 'plaid', plaid_id: 'ins_116394' },
  { id: 'schwab',      name: 'Charles Schwab',   domain: 'schwab.com',          category: 'brokerage',  aggregator: 'plaid', plaid_id: 'ins_117529' },
  { id: 'vanguard',    name: 'Vanguard',         domain: 'vanguard.com',        category: 'brokerage',  aggregator: 'plaid', plaid_id: 'ins_117218' },
  // ── Banks ──────────────────────────────────────────────────────────────────
  { id: 'citi',        name: 'Citibank',         domain: 'citibank.com',        category: 'bank',       aggregator: 'plaid', plaid_id: 'ins_5'      },
  { id: 'usbank',      name: 'US Bank',          domain: 'usbank.com',          category: 'bank',       aggregator: 'plaid', plaid_id: 'ins_8'      },
  { id: 'pnc',         name: 'PNC Bank',         domain: 'pnc.com',             category: 'bank',       aggregator: 'plaid', plaid_id: 'ins_21'     },
  { id: 'td',          name: 'TD Bank',          domain: 'tdbank.com',          category: 'bank',       aggregator: 'plaid', plaid_id: 'ins_22'     },
  { id: 'truist',      name: 'Truist',           domain: 'truist.com',          category: 'bank',       aggregator: 'plaid', plaid_id: 'ins_117182' },
  { id: 'usaa',        name: 'USAA',             domain: 'usaa.com',            category: 'bank',       aggregator: 'plaid', plaid_id: 'ins_23'     },
  { id: 'navyfed',     name: 'Navy Federal',     domain: 'navyfederal.org',     category: 'bank',       aggregator: 'plaid', plaid_id: 'ins_10'     },
  { id: 'ally',        name: 'Ally Bank',        domain: 'ally.com',            category: 'bank',       aggregator: 'plaid', plaid_id: 'ins_116914' },
  { id: 'sofi',        name: 'SoFi',             domain: 'sofi.com',            category: 'bank',       aggregator: 'plaid', plaid_id: 'ins_117650' },
  { id: 'marcus',      name: 'Marcus',           domain: 'marcus.com',          category: 'bank',       aggregator: 'plaid' },
  { id: 'discover_b',  name: 'Discover Bank',    domain: 'discover.com',        category: 'bank',       aggregator: 'plaid', plaid_id: 'ins_73'     },
  { id: 'chime',       name: 'Chime',            domain: 'chime.com',           category: 'bank',       aggregator: 'plaid' },
  // ── Brokerages ─────────────────────────────────────────────────────────────
  { id: 'robinhood',   name: 'Robinhood',        domain: 'robinhood.com',       category: 'brokerage',  aggregator: 'plaid', plaid_id: 'ins_117272' },
  { id: 'etrade',      name: 'E*TRADE',          domain: 'etrade.com',          category: 'brokerage',  aggregator: 'plaid', plaid_id: 'ins_14'     },
  { id: 'tdameritrade', name: 'TD Ameritrade',   domain: 'tdameritrade.com',    category: 'brokerage',  aggregator: 'plaid' },
  { id: 'webull',      name: 'Webull',           domain: 'webull.com',          category: 'brokerage',  aggregator: 'plaid' },
  { id: 'coinbase',    name: 'Coinbase',         domain: 'coinbase.com',        category: 'brokerage',  aggregator: 'plaid' },
  { id: 'wealthfront', name: 'Wealthfront',      domain: 'wealthfront.com',     category: 'brokerage',  aggregator: 'plaid' },
  { id: 'betterment',  name: 'Betterment',       domain: 'betterment.com',      category: 'brokerage',  aggregator: 'plaid' },
  // ── Credit Cards ────────────────────────────────────────────────────────────
  { id: 'amex',        name: 'American Express', domain: 'americanexpress.com', category: 'credit',     aggregator: 'plaid', plaid_id: 'ins_10'     },
  { id: 'discover_cc', name: 'Discover Card',    domain: 'discover.com',        category: 'credit',     aggregator: 'plaid', plaid_id: 'ins_73'     },
  { id: 'apple_card',  name: 'Apple Card',       domain: 'apple.com',           category: 'credit',     aggregator: 'plaid' },
  // ── Mortgage ───────────────────────────────────────────────────────────────
  { id: 'mrcooper',    name: 'Mr. Cooper',       domain: 'mrcooper.com',        category: 'mortgage',   aggregator: 'plaid' },
  { id: 'rocket',      name: 'Rocket Mortgage',  domain: 'rocketmortgage.com',  category: 'mortgage',   aggregator: 'plaid' },
  { id: 'loandepot',   name: 'loanDepot',        domain: 'loandepot.com',       category: 'mortgage',   aggregator: 'plaid' },
  { id: 'pennymac',    name: 'PennyMac',         domain: 'pennymac.com',        category: 'mortgage',   aggregator: 'plaid' },
];

const POPULAR = ['chase', 'bofa', 'capone', 'fidelity', 'schwab', 'vanguard', 'wells', 'amex'];

const CATEGORIES = [
  { key: 'all',      label: 'All' },
  { key: 'bank',     label: 'Banks' },
  { key: 'brokerage',label: 'Brokerages' },
  { key: 'credit',   label: 'Credit Cards' },
  { key: 'mortgage', label: 'Mortgage' },
];

// ── Colours (match Dashboard palette) ────────────────────────────────────────
const BLUE     = '#4da3ff';
const TEXT     = '#f1f5f9';
const TEXT2    = '#94a3b8';
const TEXT3    = '#475569';
const CARD_BG  = '#0f1629';
const MUTED    = 'rgba(255,255,255,0.04)';
const BORDER   = '1px solid rgba(255,255,255,0.08)';

function LogoAvatar({ name, domain, size = 36 }) {
  const [err, setErr] = useState(false);
  const letter = name.charAt(0).toUpperCase();
  const hue = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) & 0xffff, 0) % 360;

  if (!err) {
    return (
      <img
        src={`https://logo.clearbit.com/${domain}`}
        alt={name}
        onError={() => setErr(true)}
        style={{ width: size, height: size, borderRadius: 8, objectFit: 'contain', background: '#fff', display: 'block' }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: 8, flexShrink: 0,
      background: `hsl(${hue},55%,28%)`, display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.42, fontWeight: 700, color: '#fff',
    }}>
      {letter}
    </div>
  );
}

export default function ConnectAccountModal({ onSuccess, onClose }) {
  const [query, setQuery]           = useState('');
  const [cat, setCat]               = useState('all');
  const [linking, setLinking]       = useState(null); // institution being linked
  const [error, setError]           = useState('');
  const [showConsent, setShowConsent] = useState(false);
  const [selected, setSelected]     = useState(null);
  const handlerRef                  = useRef(null);
  const searchRef                   = useRef(null);

  useEffect(() => { searchRef.current?.focus(); }, []);

  // Filter institutions
  const filtered = INSTITUTIONS.filter(inst => {
    const matchCat = cat === 'all' || inst.category === cat;
    const matchQ   = !query || inst.name.toLowerCase().includes(query.toLowerCase());
    return matchCat && matchQ;
  });

  const popular = INSTITUTIONS.filter(i => POPULAR.includes(i.id));

  const handleSelect = (inst) => {
    setSelected(inst);
    setShowConsent(true);
  };

  const launchPlaid = async (inst) => {
    setLinking(inst.id);
    setError('');
    try {
      const body = inst.plaid_id ? { institution_id: inst.plaid_id } : {};
      const { data } = await api.post('/plaid/create_link_token', body);
      const linkToken = data.link_token;

      const init = () => {
        const config = {
          token: linkToken,
          onSuccess: async (public_token, metadata) => {
            try {
              await api.post('/plaid/exchange_token', {
                public_token,
                institution_name: metadata.institution?.name || inst.name,
              });
              setLinking(null);
              onSuccess(metadata.institution?.name || inst.name);
              onClose();
            } catch (err) {
              console.error('Token exchange error:', err);
              setError('Failed to connect. Please try again.');
              setLinking(null);
            }
          },
          onExit: (err) => {
            setLinking(null);
            if (err && err.error_code !== 'INSTITUTION_NOT_RESPONDING') {
              setError(err.display_message || err.error_message || '');
            }
          },
          onEvent: (eventName, metadata) => {
            console.log('[Plaid Link event]', eventName, {
              institution_name: metadata?.institution_name,
              link_session_id:  metadata?.link_session_id,
              request_id:       metadata?.request_id,
              error_code:       metadata?.error_code,
            });
          },
        };
        if (window.location.href.includes('oauth_state_id')) {
          config.receivedRedirectUri = window.location.href;
        }
        handlerRef.current = window.Plaid.create(config);
        window._plaidLinkHandler = handlerRef.current;
        handlerRef.current.open();
      };

      if (window.Plaid) {
        init();
      } else {
        const existing = document.querySelector('script[src*="plaid.com/link"]');
        if (existing) existing.addEventListener('load', init);
      }
    } catch (err) {
      console.error('create_link_token error:', err);
      setError(err.response?.data?.error || 'Could not initialize connection.');
      setLinking(null);
    }
  };

  const handleConsent = () => {
    setShowConsent(false);
    if (selected?.aggregator === 'plaid') {
      launchPlaid(selected);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 9990,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9991,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24, pointerEvents: 'none',
      }}>
        <div
          onClick={e => e.stopPropagation()}
          style={{
            background: CARD_BG,
            border: BORDER,
            borderRadius: 16,
            width: '100%',
            maxWidth: 560,
            maxHeight: '82vh',
            display: 'flex',
            flexDirection: 'column',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            pointerEvents: 'auto',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{ padding: '20px 24px 16px', borderBottom: BORDER, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: TEXT }}>Connect an Account</div>
              <button
                onClick={onClose}
                style={{ background: 'none', border: 'none', color: TEXT3, cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 4 }}
              >
                ×
              </button>
            </div>

            {/* Search */}
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: TEXT3, fontSize: 14 }}>⌕</span>
              <input
                ref={searchRef}
                value={query}
                onChange={e => { setQuery(e.target.value); setCat('all'); }}
                placeholder="Search banks and brokerages..."
                style={{
                  width: '100%', padding: '9px 12px 9px 34px',
                  background: MUTED, border: BORDER,
                  borderRadius: 9, color: TEXT, fontSize: 13, outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Category tabs */}
            {!query && (
              <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                {CATEGORIES.map(c => (
                  <button
                    key={c.key}
                    onClick={() => setCat(c.key)}
                    style={{
                      padding: '5px 14px', borderRadius: 20, border: 'none',
                      background: cat === c.key ? BLUE : MUTED,
                      color: cat === c.key ? '#fff' : TEXT2,
                      fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      transition: 'all 0.12s',
                    }}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Error banner */}
          {error && (
            <div style={{ padding: '10px 24px', background: 'rgba(248,113,113,0.08)', borderBottom: '1px solid rgba(248,113,113,0.2)', fontSize: 12, color: '#f87171' }}>
              {error} <button onClick={() => setError('')} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', marginLeft: 8, fontWeight: 700 }}>Dismiss</button>
            </div>
          )}

          {/* Institution list */}
          <div style={{ overflowY: 'auto', flex: 1, padding: '16px 24px 20px' }}>

            {/* Popular row (no search, no category filter) */}
            {!query && cat === 'all' && (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, color: TEXT3, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 10 }}>Popular</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 22 }}>
                  {popular.map(inst => (
                    <InstitutionCard key={inst.id} inst={inst} linking={linking} onClick={() => handleSelect(inst)} compact />
                  ))}
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: TEXT3, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 10 }}>All</div>
              </>
            )}

            {/* Filtered list */}
            {filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: TEXT3, fontSize: 13 }}>
                No institutions match "{query}". Try connecting through the generic Plaid search.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {filtered.map(inst => (
                  <InstitutionRow key={inst.id} inst={inst} linking={linking} onClick={() => handleSelect(inst)} />
                ))}
              </div>
            )}

            {/* Fallback: generic Plaid search */}
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: BORDER }}>
              <div style={{ fontSize: 12, color: TEXT3, marginBottom: 10 }}>Don't see yours?</div>
              <button
                onClick={() => handleSelect({ id: '__plaid_search', name: 'Search all institutions', domain: '', category: 'bank', aggregator: 'plaid', plaid_id: null })}
                disabled={!!linking}
                style={{
                  width: '100%', padding: '10px 0',
                  background: MUTED, border: BORDER,
                  borderRadius: 8, color: TEXT2,
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                + Search all institutions via Plaid
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Consent modal */}
      {showConsent && selected && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: '#161b2e', border: BORDER, borderRadius: 14, padding: 28, maxWidth: 400, width: '100%', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              {selected.domain && <LogoAvatar name={selected.name} domain={selected.domain} size={32} />}
              <div style={{ fontSize: 16, fontWeight: 700, color: TEXT }}>{selected.name}</div>
            </div>
            <div style={{ fontSize: 13, color: TEXT2, lineHeight: 1.65, marginBottom: 18 }}>
              PeakLedger will securely read your financial data from {selected.name} using{' '}
              <a href="https://plaid.com" target="_blank" rel="noreferrer" style={{ color: BLUE, textDecoration: 'none' }}>Plaid</a>.
              By connecting, you authorize access to:
            </div>
            <ul style={{ paddingLeft: 0, margin: '0 0 18px', listStyle: 'none' }}>
              {['Account balances and names', 'Transaction history', 'Investment holdings', 'Liability details (credit cards, loans)'].map(item => (
                <li key={item} style={{ fontSize: 13, color: '#cbd5e1', marginBottom: 7, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <span style={{ color: '#4ade80', flexShrink: 0, marginTop: 1 }}>✓</span>{item}
                </li>
              ))}
            </ul>
            <div style={{ fontSize: 12, color: TEXT3, lineHeight: 1.6, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12, marginBottom: 18 }}>
              Your credentials are never seen by PeakLedger. Read our{' '}
              <a href="/privacy" target="_blank" rel="noreferrer" style={{ color: BLUE, textDecoration: 'none' }}>Privacy Policy</a> and{' '}
              <a href="https://plaid.com/legal/#end-user-privacy-policy" target="_blank" rel="noreferrer" style={{ color: BLUE, textDecoration: 'none' }}>Plaid's Privacy Policy</a>.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setShowConsent(false); setSelected(null); }} style={{ flex: 1, padding: '10px 0', background: MUTED, border: BORDER, borderRadius: 8, color: TEXT2, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleConsent} style={{ flex: 2, padding: '10px 0', background: '#0066f5', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                {linking ? 'Connecting...' : 'Agree & Connect'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function InstitutionCard({ inst, linking, onClick, compact }) {
  const isLoading = linking === inst.id;
  return (
    <button
      onClick={onClick}
      disabled={!!linking}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        padding: '12px 8px', background: MUTED, border: BORDER,
        borderRadius: 10, cursor: linking ? 'not-allowed' : 'pointer',
        opacity: linking && !isLoading ? 0.5 : 1,
        transition: 'all 0.12s',
      }}
    >
      <LogoAvatar name={inst.name} domain={inst.domain} size={compact ? 34 : 40} />
      <div style={{ fontSize: 11, fontWeight: 600, color: TEXT2, textAlign: 'center', lineHeight: 1.3 }}>
        {isLoading ? '…' : inst.name}
      </div>
    </button>
  );
}

function InstitutionRow({ inst, linking, onClick }) {
  const isLoading = linking === inst.id;
  const catLabels = { bank: 'Bank', brokerage: 'Brokerage', credit: 'Credit Card', mortgage: 'Mortgage' };
  return (
    <button
      onClick={onClick}
      disabled={!!linking}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 12px', background: 'transparent',
        border: '1px solid transparent', borderRadius: 9,
        cursor: linking ? 'not-allowed' : 'pointer',
        opacity: linking && !isLoading ? 0.5 : 1,
        transition: 'all 0.12s', textAlign: 'left', width: '100%',
      }}
      onMouseEnter={e => { if (!linking) e.currentTarget.style.background = MUTED; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
    >
      <LogoAvatar name={inst.name} domain={inst.domain} size={36} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{inst.name}</div>
        <div style={{ fontSize: 11, color: TEXT3, marginTop: 1 }}>{catLabels[inst.category] || inst.category}</div>
      </div>
      {isLoading ? (
        <div style={{ fontSize: 12, color: BLUE }}>Connecting...</div>
      ) : (
        <div style={{ fontSize: 18, color: TEXT3 }}>›</div>
      )}
    </button>
  );
}
