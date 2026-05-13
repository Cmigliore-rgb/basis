import React, { useState, useRef, useEffect } from 'react';
import api from '../../services/api';

const BLUE  = '#4da3ff';
const TEXT  = '#f1f5f9';
const TEXT2 = '#94a3b8';
const TEXT3 = '#475569';

export default function ConnectAccountModal({ onSuccess, onClose }) {
  const [step, setStep]       = useState('consent'); // 'consent' | 'linking'
  const [error, setError]     = useState('');
  const handlerRef            = useRef(null);

  useEffect(() => {
    return () => { handlerRef.current?.destroy?.(); };
  }, []);

  const launchPlaid = async () => {
    setStep('linking');
    setError('');
    try {
      const { data } = await api.post('/plaid/create_link_token', {});

      const init = () => {
        if (!window.Plaid) {
          setError('Plaid failed to load. Please refresh and try again.');
          setStep('consent');
          return;
        }
        handlerRef.current = window.Plaid.create({
          token: data.link_token,
          onSuccess: async (public_token, metadata) => {
            try {
              await api.post('/plaid/exchange_token', {
                public_token,
                institution_name: metadata.institution?.name || 'Unknown',
              });
              localStorage.removeItem('plaid_link_token');
              onSuccess(metadata.institution?.name || 'Your bank');
              onClose();
            } catch {
              setError('Failed to connect. Please try again.');
              setStep('consent');
            }
          },
          onExit: (err) => {
            setStep('consent');
            if (err && err.error_code !== 'INSTITUTION_NOT_RESPONDING') {
              setError(err.display_message || err.error_message || '');
            }
          },
          onEvent: (eventName, metadata) => {
            console.log('[Plaid event]', eventName, metadata?.institution_name, metadata?.error_code);
          },
        });
        localStorage.setItem('plaid_link_token', data.link_token);
        handlerRef.current.open();
      };

      if (window.Plaid) {
        init();
      } else {
        const script = document.createElement('script');
        script.src = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js';
        script.onload = init;
        script.onerror = () => {
          setError('Could not load Plaid. Check your connection and try again.');
          setStep('consent');
        };
        document.head.appendChild(script);
      }
    } catch (err) {
      const msg = err.response?.data?.error;
      setError(typeof msg === 'string' ? msg : 'Could not initialize connection. Please try again.');
      setStep('consent');
    }
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
            background: '#161b2e',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 16,
            padding: 32,
            width: '100%',
            maxWidth: 420,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            pointerEvents: 'auto',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: TEXT }}>Connect your bank</div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: TEXT3, cursor: 'pointer', fontSize: 22, lineHeight: 1, padding: 2 }}>×</button>
          </div>

          <div style={{ fontSize: 13, color: TEXT2, lineHeight: 1.65, marginBottom: 20 }}>
            PeakLedger uses <a href="https://plaid.com" target="_blank" rel="noreferrer" style={{ color: BLUE, textDecoration: 'none' }}>Plaid</a> to securely read your financial data. By connecting, you authorize access to:
          </div>

          <ul style={{ paddingLeft: 0, margin: '0 0 20px', listStyle: 'none' }}>
            {['Account balances and names', 'Transaction history', 'Investment holdings', 'Liability details (credit cards, loans)'].map(item => (
              <li key={item} style={{ fontSize: 13, color: '#cbd5e1', marginBottom: 8, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ color: '#4ade80', flexShrink: 0, marginTop: 1 }}>✓</span>{item}
              </li>
            ))}
          </ul>

          <div style={{ fontSize: 11, color: TEXT3, lineHeight: 1.6, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 14, marginBottom: 24 }}>
            Your credentials are never seen by PeakLedger. Read our{' '}
            <a href="/privacy" target="_blank" rel="noreferrer" style={{ color: BLUE, textDecoration: 'none' }}>Privacy Policy</a>{' '}and{' '}
            <a href="https://plaid.com/legal/#end-user-privacy-policy" target="_blank" rel="noreferrer" style={{ color: BLUE, textDecoration: 'none' }}>Plaid's Privacy Policy</a>.
          </div>

          {error && (
            <div style={{ fontSize: 12, color: '#f87171', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.15)', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={onClose}
              style={{ flex: 1, padding: '11px 0', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: TEXT2, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              onClick={launchPlaid}
              disabled={step === 'linking'}
              style={{ flex: 2, padding: '11px 0', background: step === 'linking' ? '#555' : '#0066f5', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: step === 'linking' ? 'not-allowed' : 'pointer', opacity: step === 'linking' ? 0.7 : 1 }}
            >
              {step === 'linking' ? 'Opening Plaid…' : 'Agree and Connect'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
