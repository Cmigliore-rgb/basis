import React, { useEffect, useState } from 'react';
import api from '../../services/api';

export default function PlaidLink({ onSuccess }) {
  const [linkToken, setLinkToken] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.post('/plaid/create_link_token')
      .then(r => setLinkToken(r.data.link_token))
      .catch(err => console.error('Plaid link token error:', err));
  }, []);

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
      if (window.location.href.includes('oauth_state_id')) {
        window._plaidLinkHandler.open();
      }
    };
    document.body.appendChild(script);
    return () => { if (document.body.contains(script)) document.body.removeChild(script); };
  }, [linkToken, onSuccess]);

  return (
    <button
      onClick={() => window._plaidLinkHandler?.open()}
      disabled={!linkToken || loading}
      style={{
        width: '100%',
        padding: '9px 0',
        background: loading ? '#ccc' : '#0066f5',
        color: '#fff',
        border: 'none',
        borderRadius: 6,
        cursor: loading ? 'not-allowed' : 'pointer',
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      {loading ? 'Connecting...' : '+ Connect via Plaid'}
    </button>
  );
}
