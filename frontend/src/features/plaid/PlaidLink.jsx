import React, { useEffect, useState } from 'react';
import api from '../../services/api';

export default function PlaidLink({ onSuccess, locked, onLocked }) {
  const [linkToken, setLinkToken]     = useState(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [ready, setReady]             = useState(false);
  const [showConsent, setShowConsent] = useState(false);

  useEffect(() => {
    if (locked) return;
    setError('');
    api.post('/plaid/create_link_token')
      .then(r => setLinkToken(r.data.link_token))
      .catch(err => {
        console.error('Plaid link token error:', err);
        setError(err.response?.data?.error || 'Could not initialize Plaid. Check your credentials.');
      });
  }, [locked]);

  useEffect(() => {
    if (!linkToken) return;
    const script = document.createElement('script');
    script.src = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js';
    script.onload = () => {
      const config = {
        token: linkToken,
        onSuccess: async (public_token, metadata) => {
          setLoading(true);
          try {
            await api.post('/plaid/exchange_token', {
              public_token,
              institution_name: metadata.institution?.name || 'Unknown',
            });
            if (onSuccess) onSuccess();
          } catch (err) {
            console.error('Token exchange error:', err);
            setError('Failed to connect account. Please try again.');
          } finally {
            setLoading(false);
          }
        },
        onExit: (err) => { if (err) console.error('Plaid exit:', err); },
      };
      if (window.location.href.includes('oauth_state_id')) {
        config.receivedRedirectUri = window.location.href;
      }
      window._plaidLinkHandler = window.Plaid.create(config);
      setReady(true);
      if (window.location.href.includes('oauth_state_id')) {
        window._plaidLinkHandler.open();
      }
    };
    script.onerror = () => setError('Failed to load Plaid. Check your connection.');
    document.body.appendChild(script);
    return () => { if (document.body.contains(script)) document.body.removeChild(script); };
  }, [linkToken, onSuccess]);

  const handleConnectClick = () => {
    if (locked) { onLocked?.(); return; }
    setShowConsent(true);
  };

  if (locked) {
    return (
      <button onClick={onLocked} style={btnStyle('#4da3ff', 'rgba(77,163,255,0.08)', '1px solid rgba(77,163,255,0.25)', 'pointer')}>
        + Connect Account
      </button>
    );
  }

  if (error) {
    return (
      <div style={{ fontSize: 12, color: '#f87171', padding: '8px 4px', lineHeight: 1.4 }}>
        {error}
      </div>
    );
  }

  return (
    <>
      <button
        onClick={handleConnectClick}
        disabled={!ready || loading}
        style={btnStyle('#fff', loading ? '#555' : '#0066f5', 'none', (!ready || loading) ? 'not-allowed' : 'pointer', (!ready || loading) ? 0.6 : 1)}
      >
        {loading ? 'Connecting...' : !ready ? 'Loading...' : '+ Connect Account'}
      </button>

      {showConsent && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.75)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', padding: 24,
        }} onClick={() => setShowConsent(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#161b2e', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 14, padding: 28, maxWidth: 440, width: '100%',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#f1f5f9', marginBottom: 8 }}>
              Connect your bank account
            </div>
            <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.65, marginBottom: 20 }}>
              PeakLedger uses{' '}
              <a href="https://plaid.com" target="_blank" rel="noreferrer"
                style={{ color: '#4da3ff', textDecoration: 'none' }}>Plaid</a>{' '}
              to securely read your financial data. By connecting, you authorize PeakLedger to access:
            </div>

            <ul style={{ paddingLeft: 18, margin: '0 0 20px', listStyle: 'none' }}>
              {[
                'Account balances and names',
                'Transaction history',
                'Investment holdings',
                'Liability details (credit cards, loans)',
              ].map(item => (
                <li key={item} style={{
                  fontSize: 13, color: '#cbd5e1', marginBottom: 8,
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                }}>
                  <span style={{ color: '#4ade80', marginTop: 1, flexShrink: 0 }}>✓</span>
                  {item}
                </li>
              ))}
            </ul>

            <div style={{
              fontSize: 12, color: '#64748b', lineHeight: 1.6,
              borderTop: '1px solid rgba(255,255,255,0.06)',
              paddingTop: 14, marginBottom: 20,
            }}>
              Your credentials are never seen by PeakLedger. Plaid's secure interface handles
              authentication. Read our{' '}
              <a href="/privacy" target="_blank" rel="noreferrer"
                style={{ color: '#4da3ff', textDecoration: 'none' }}>Privacy Policy</a>{' '}
              and{' '}
              <a href="https://plaid.com/legal/#end-user-privacy-policy" target="_blank" rel="noreferrer"
                style={{ color: '#4da3ff', textDecoration: 'none' }}>Plaid's Privacy Policy</a>.
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setShowConsent(false)}
                style={{
                  flex: 1, padding: '10px 0',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 8, color: '#94a3b8',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => { setShowConsent(false); window._plaidLinkHandler?.open(); }}
                style={{
                  flex: 2, padding: '10px 0',
                  background: '#0066f5', border: 'none',
                  borderRadius: 8, color: '#fff',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}
              >
                Agree &amp; Connect
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function btnStyle(color, bg, border, cursor, opacity = 1) {
  return {
    width: '100%', padding: '9px 0', background: bg, color, border,
    borderRadius: 6, cursor, fontSize: 13, fontWeight: 600, opacity,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  };
}
