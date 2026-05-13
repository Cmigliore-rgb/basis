import React, { useState, useEffect, useRef } from 'react';
import api from '../../services/api';

// ── Institution registry ─────────────────────────────────────────────────────
// aggregator: 'plaid' | 'akoya' | 'mr_cooper' | 'yodlee' | 'manual'
// plaid_id: Plaid production institution_id (pre-selects institution in Link)
const INSTITUTIONS = [
  { id: 'chase',       name: 'Chase',            domain: 'chase.com',           category: 'bank',       aggregator: 'plaid', plaid_id: 'ins_56'     },
  { id: 'fidelity',    name: 'Fidelity',         domain: 'fidelity.com',        category: 'brokerage',  aggregator: 'plaid', plaid_id: 'ins_116394' },
  { id: 'wells',       name: 'Wells Fargo',      domain: 'wellsfargo.com',      category: 'bank',       aggregator: 'plaid', plaid_id: 'ins_4'      },
  { id: 'bofa',        name: 'Bank of America',  domain: 'bankofamerica.com',   category: 'bank',       aggregator: 'plaid', plaid_id: 'ins_3'      },
  { id: 'citi',        name: 'Citibank',         domain: 'citibank.com',        category: 'bank',       aggregator: 'plaid', plaid_id: 'ins_5'      },
  { id: 'amex',        name: 'American Express', domain: 'americanexpress.com', category: 'credit',     aggregator: 'plaid', plaid_id: 'ins_10'     },
  { id: 'discover',    name: 'Discover',         domain: 'discover.com',        category: 'credit',     aggregator: 'plaid', plaid_id: 'ins_73'     },
  { id: 'sofi',        name: 'SoFi',             domain: 'sofi.com',            category: 'bank',       aggregator: 'plaid', plaid_id: 'ins_117650' },
  { id: 'capone',      name: 'Capital One',      domain: 'capitalone.com',      category: 'bank',       aggregator: 'plaid', plaid_id: 'ins_9'      },
  { id: 'vanguard',    name: 'Vanguard',         domain: 'vanguard.com',        category: 'brokerage',  aggregator: 'plaid', plaid_id: 'ins_117218' },
  { id: 'etrade',      name: 'E*TRADE',          domain: 'etrade.com',          category: 'brokerage',  aggregator: 'plaid', plaid_id: 'ins_14'     },
  { id: 'schwab',      name: 'Charles Schwab',   domain: 'schwab.com',          category: 'brokerage',  aggregator: 'plaid', plaid_id: 'ins_117529' },
  { id: 'usbank',      name: 'US Bank',          domain: 'usbank.com',          category: 'bank',       aggregator: 'plaid', plaid_id: 'ins_8'      },
  { id: 'pnc',         name: 'PNC Bank',         domain: 'pnc.com',             category: 'bank',       aggregator: 'plaid', plaid_id: 'ins_21'     },
  { id: 'td',          name: 'TD Bank',          domain: 'tdbank.com',          category: 'bank',       aggregator: 'plaid', plaid_id: 'ins_22'     },
  { id: 'truist',      name: 'Truist',           domain: 'truist.com',          category: 'bank',       aggregator: 'plaid', plaid_id: 'ins_117182' },
  { id: 'usaa',        name: 'USAA',             domain: 'usaa.com',            category: 'bank',       aggregator: 'plaid', plaid_id: 'ins_23'     },
  { id: 'navyfed',     name: 'Navy Federal',     domain: 'navyfederal.org',     category: 'bank',       aggregator: 'plaid', plaid_id: 'ins_133013' },
  { id: 'ally',        name: 'Ally Bank',        domain: 'ally.com',            category: 'bank',       aggregator: 'plaid', plaid_id: 'ins_116914' },
  { id: 'robinhood',   name: 'Robinhood',        domain: 'robinhood.com',       category: 'brokerage',  aggregator: 'plaid', plaid_id: 'ins_117272' },
  { id: 'wealthfront', name: 'Wealthfront',      domain: 'wealthfront.com',     category: 'brokerage',  aggregator: 'plaid' },
  { id: 'betterment',  name: 'Betterment',       domain: 'betterment.com',      category: 'brokerage',  aggregator: 'plaid' },
  { id: 'chime',       name: 'Chime',            domain: 'chime.com',           category: 'bank',       aggregator: 'plaid' },
  { id: 'apple_card',  name: 'Apple Card',       domain: 'apple.com',           category: 'credit',     aggregator: 'plaid' },
  { id: 'mrcooper',    name: 'Mr. Cooper',        domain: 'mrcooper.com',        category: 'mortgage',   aggregator: 'plaid' },
  { id: 'rocket',      name: 'Rocket Mortgage',  domain: 'rocketmortgage.com',  category: 'mortgage',   aggregator: 'plaid' },
  { id: 'pennymac',    name: 'PennyMac',         domain: 'pennymac.com',        category: 'mortgage',   aggregator: 'plaid' },
  { id: 'coinbase',    name: 'Coinbase',         domain: 'coinbase.com',        category: 'brokerage',  aggregator: 'plaid' },
  { id: 'webull',      name: 'Webull',           domain: 'webull.com',          category: 'brokerage',  aggregator: 'plaid' },
  { id: 'marcus',      name: 'Marcus',           domain: 'marcus.com',          category: 'bank',       aggregator: 'plaid' },
];

const CATEGORIES = [
  { key: 'all',      label: 'All' },
  { key: 'bank',     label: 'Banks' },
  { key: 'brokerage',label: 'Brokerages' },
  { key: 'credit',   label: 'Credit Cards' },
  { key: 'mortgage', label: 'Mortgage' },
];

const BLUE  = '#4da3ff';
const TEXT  = '#f1f5f9';
const TEXT2 = '#94a3b8';
const TEXT3 = '#475569';

function LogoTile({ inst, onClick, isLoading, disabled }) {
  // Try Plaid logo → clearbit → letter avatar
  const sources = [
    inst.plaid_id ? `/api/plaid/institution_logo/${inst.plaid_id}` : null,
    inst.domain   ? `https://logo.clearbit.com/${inst.domain}` : null,
  ].filter(Boolean);

  const [srcIdx, setSrcIdx] = useState(0);
  const letter = inst.name.charAt(0).toUpperCase();
  const hue = [...inst.name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) & 0xffff, 0) % 360;
  const failed = srcIdx >= sources.length;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={inst.name}
      style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 10,
        padding: '14px 10px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        aspectRatio: '3/2',
        transition: 'box-shadow 0.12s, transform 0.12s',
        opacity: disabled && !isLoading ? 0.5 : 1,
        position: 'relative',
      }}
      onMouseEnter={e => { if (!disabled) { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)'; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}
    >
      {isLoading ? (
        <div style={{ fontSize: 11, color: BLUE, fontWeight: 700 }}>Connecting...</div>
      ) : !failed ? (
        <img
          key={srcIdx}
          src={sources[srcIdx]}
          alt={inst.name}
          onError={() => setSrcIdx(i => i + 1)}
          style={{ maxWidth: '82%', maxHeight: 46, objectFit: 'contain', display: 'block' }}
        />
      ) : (
        <div style={{
          width: 44, height: 44, borderRadius: 8,
          background: `hsl(${hue},50%,55%)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20, fontWeight: 800, color: '#fff',
        }}>
          {letter}
        </div>
      )}
    </button>
  );
}

export default function ConnectAccountModal({ onSuccess, onClose }) {
  const [query, setQuery]             = useState('');
  const [cat, setCat]                 = useState('all');
  const [linking, setLinking]         = useState(null);
  const [error, setError]             = useState('');
  const [showConsent, setShowConsent] = useState(false);
  const [selected, setSelected]       = useState(null);
  const handlerRef                    = useRef(null);
  const searchRef                     = useRef(null);

  useEffect(() => { searchRef.current?.focus(); }, []);

  const filtered = INSTITUTIONS.filter(inst => {
    const matchCat = cat === 'all' || inst.category === cat;
    const matchQ   = !query || inst.name.toLowerCase().includes(query.toLowerCase());
    return matchCat && matchQ;
  });

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

      const init = () => {
        if (!window.Plaid) {
          setError('Plaid failed to load. Please refresh the page and try again.');
          setLinking(null);
          return;
        }
        const config = {
          token: data.link_token,
          onSuccess: async (public_token, metadata) => {
            try {
              await api.post('/plaid/exchange_token', {
                public_token,
                institution_name: metadata.institution?.name || inst.name,
              });
              localStorage.removeItem('plaid_link_token');
              setLinking(null);
              onSuccess(metadata.institution?.name || inst.name);
              onClose();
            } catch {
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
        localStorage.setItem('plaid_link_token', data.link_token);
        handlerRef.current.open();
      };

      if (window.Plaid) {
        init();
      } else {
        // Script may have already fired its load event — inject a fresh copy
        const script = document.createElement('script');
        script.src = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js';
        script.onload = init;
        script.onerror = () => {
          setError('Could not load Plaid. Check your internet connection and try again.');
          setLinking(null);
        };
        document.head.appendChild(script);
      }
    } catch (err) {
      const msg = err.response?.data?.error;
      setError(typeof msg === 'string' ? msg : 'Could not initialize connection. Please try again.');
      setLinking(null);
    }
  };

  const handleConsent = () => {
    setShowConsent(false);
    if (selected?.aggregator === 'plaid') launchPlaid(selected);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 9990, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
      />

      {/* Modal */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 9991, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, pointerEvents: 'none' }}>
        <div
          onClick={e => e.stopPropagation()}
          style={{
            background: '#0f1629',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 16,
            width: '100%',
            maxWidth: 580,
            maxHeight: '86vh',
            display: 'flex',
            flexDirection: 'column',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            pointerEvents: 'auto',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{ padding: '22px 24px 16px', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: TEXT }}>Connect an account</div>
              <button onClick={onClose} style={{ background: 'none', border: 'none', color: TEXT3, cursor: 'pointer', fontSize: 22, lineHeight: 1, padding: 2 }}>×</button>
            </div>

            {/* Search */}
            <div style={{ position: 'relative', marginBottom: 14 }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: TEXT3, fontSize: 15, pointerEvents: 'none' }}>⌕</span>
              <input
                ref={searchRef}
                value={query}
                onChange={e => { setQuery(e.target.value); setCat('all'); }}
                placeholder="Search banks and brokerages..."
                style={{
                  width: '100%', padding: '10px 12px 10px 36px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 10, color: TEXT, fontSize: 13, outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Category tabs */}
            <div style={{ display: 'flex', gap: 6 }}>
              {CATEGORIES.map(c => (
                <button
                  key={c.key}
                  onClick={() => { setCat(c.key); setQuery(''); }}
                  style={{
                    padding: '5px 14px', borderRadius: 20, border: 'none',
                    background: cat === c.key ? BLUE : 'rgba(255,255,255,0.06)',
                    color: cat === c.key ? '#fff' : TEXT2,
                    fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.12s',
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{ padding: '9px 24px', background: 'rgba(248,113,113,0.08)', borderTop: '1px solid rgba(248,113,113,0.15)', fontSize: 12, color: '#f87171', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {error}
              <button onClick={() => setError('')} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>×</button>
            </div>
          )}

          {/* Sub-header */}
          <div style={{ padding: '4px 24px 12px', flexShrink: 0 }}>
            <div style={{ fontSize: 12, color: TEXT3 }}>
              {query ? `Showing results for "${query}"` : 'Or select from these financial institutions:'}
            </div>
          </div>

          {/* Institution grid */}
          <div style={{ overflowY: 'auto', flex: 1, padding: '0 24px 24px' }}>
            {filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: TEXT3, fontSize: 13 }}>
                No results for "{query}".
                <br />
                <button
                  onClick={() => handleSelect({ id: '__search', name: 'Plaid search', domain: '', category: 'bank', aggregator: 'plaid', plaid_id: null })}
                  style={{ marginTop: 12, padding: '8px 18px', background: 'rgba(77,163,255,0.1)', border: '1px solid rgba(77,163,255,0.3)', borderRadius: 8, color: BLUE, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  Search all institutions
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                {filtered.map(inst => (
                  <LogoTile
                    key={inst.id}
                    inst={inst}
                    isLoading={linking === inst.id}
                    disabled={!!linking}
                    onClick={() => handleSelect(inst)}
                  />
                ))}
              </div>
            )}

            {/* Fallback */}
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: TEXT3, marginBottom: 10 }}>Don't see your institution?</div>
              <button
                onClick={() => handleSelect({ id: '__search', name: 'Search all', domain: '', category: 'bank', aggregator: 'plaid', plaid_id: null })}
                disabled={!!linking}
                style={{ padding: '9px 22px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: TEXT2, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                Search all institutions via Plaid
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Consent modal */}
      {showConsent && selected && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: '#161b2e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 28, maxWidth: 400, width: '100%', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: TEXT, marginBottom: 14 }}>
              Connect {selected.name === 'Search all' ? 'your institution' : selected.name}
            </div>
            <div style={{ fontSize: 13, color: TEXT2, lineHeight: 1.65, marginBottom: 18 }}>
              PeakLedger uses <a href="https://plaid.com" target="_blank" rel="noreferrer" style={{ color: BLUE, textDecoration: 'none' }}>Plaid</a> to securely read your financial data. By connecting, you authorize access to:
            </div>
            <ul style={{ paddingLeft: 0, margin: '0 0 18px', listStyle: 'none' }}>
              {['Account balances and names', 'Transaction history', 'Investment holdings', 'Liability details (credit cards, loans)'].map(item => (
                <li key={item} style={{ fontSize: 13, color: '#cbd5e1', marginBottom: 7, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <span style={{ color: '#4ade80', flexShrink: 0, marginTop: 1 }}>✓</span>{item}
                </li>
              ))}
            </ul>
            <div style={{ fontSize: 11, color: TEXT3, lineHeight: 1.6, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12, marginBottom: 18 }}>
              Your credentials are never seen by PeakLedger. Read our{' '}
              <a href="/privacy" target="_blank" rel="noreferrer" style={{ color: BLUE, textDecoration: 'none' }}>Privacy Policy</a>{' '}and{' '}
              <a href="https://plaid.com/legal/#end-user-privacy-policy" target="_blank" rel="noreferrer" style={{ color: BLUE, textDecoration: 'none' }}>Plaid's Privacy Policy</a>.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setShowConsent(false); setSelected(null); }} style={{ flex: 1, padding: '10px 0', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: TEXT2, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleConsent} disabled={!!linking} style={{ flex: 2, padding: '10px 0', background: '#0066f5', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                {linking ? 'Connecting...' : 'Agree & Connect'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
