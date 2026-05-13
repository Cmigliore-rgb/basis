import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

export default function OAuthReturn() {
  const navigate = useNavigate();
  const handlerRef = useRef(null);
  const [status, setStatus] = useState('Completing connection...');

  useEffect(() => {
    const linkToken = localStorage.getItem('plaid_link_token');
    if (!linkToken) {
      setStatus('Session expired. Please try connecting again.');
      setTimeout(() => navigate('/app', { replace: true }), 2500);
      return;
    }

    const init = () => {
      if (!window.Plaid) {
        setStatus('Could not load Plaid. Please refresh and try again.');
        return;
      }

      handlerRef.current = window.Plaid.create({
        token: linkToken,
        receivedRedirectUri: window.location.href,
        onSuccess: async (public_token, metadata) => {
          try {
            await api.post('/plaid/exchange_token', {
              public_token,
              institution_name: metadata.institution?.name || 'Unknown',
            });
            localStorage.removeItem('plaid_link_token');
          } catch {
            // token exchange failed — user will see it on the dashboard
          }
          navigate('/app', { replace: true });
        },
        onExit: () => {
          navigate('/app', { replace: true });
        },
        onEvent: (eventName, metadata) => {
          console.log('[Plaid OAuth event]', eventName, metadata);
        },
      });

      handlerRef.current.open();
    };

    if (window.Plaid) {
      init();
    } else {
      const script = document.createElement('script');
      script.src = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js';
      script.onload = init;
      script.onerror = () => setStatus('Could not load Plaid. Please refresh and try again.');
      document.head.appendChild(script);
    }

    return () => { handlerRef.current?.destroy?.(); };
  }, [navigate]);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0f0f0f',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      color: '#f0f0f0',
      fontSize: 15,
    }}>
      {status}
    </div>
  );
}
