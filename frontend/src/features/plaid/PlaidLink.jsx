import React, { useEffect, useState } from 'react';
import api from '../../services/api';

export default function PlaidLink({ onSuccess, locked, onLocked }) {
  const [linkToken, setLinkToken] = useState(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [ready, setReady]         = useState(false);

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
    <button
      onClick={() => window._plaidLinkHandler?.open()}
      disabled={!ready || loading}
      style={btnStyle('#fff', loading ? '#555' : '#0066f5', 'none', (!ready || loading) ? 'not-allowed' : 'pointer', (!ready || loading) ? 0.6 : 1)}
    >
      {loading ? 'Connecting...' : !ready ? 'Loading...' : '+ Connect Account'}
    </button>
  );
}

function btnStyle(color, bg, border, cursor, opacity = 1) {
  return {
    width: '100%', padding: '9px 0', background: bg, color, border,
    borderRadius: 6, cursor, fontSize: 13, fontWeight: 600, opacity,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  };
}
