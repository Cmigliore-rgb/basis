import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

const BG     = '#0a0a0a';
const TEXT   = '#f1f5f9';
const TEXT2  = '#94a3b8';
const BORDER = '1px solid rgba(255,255,255,0.08)';
const INPUT  = '#141414';
const BLUE   = '#0066f5';

export default function ForgotPassword() {
  const [email, setEmail]     = useState('');
  const [sent, setSent]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 36, justifyContent: 'center' }}>
          <img src="/logo-icon.svg?v=5" alt="" style={{ width: 36, height: 36, borderRadius: 8 }} />
          <span style={{ fontSize: 20, fontWeight: 700, color: TEXT }}>PeakLedger</span>
        </div>

        {sent ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>✉</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: TEXT, marginBottom: 8 }}>Check your email</div>
            <div style={{ fontSize: 14, color: TEXT2, lineHeight: 1.6, marginBottom: 28 }}>
              If an account exists for <strong style={{ color: TEXT }}>{email}</strong>, you'll receive a password reset link shortly. Check your spam folder if you don't see it.
            </div>
            <Link to="/login" style={{ fontSize: 13, color: BLUE, textDecoration: 'none', fontWeight: 600 }}>Back to sign in</Link>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: TEXT, marginBottom: 6 }}>Forgot your password?</div>
              <div style={{ fontSize: 14, color: TEXT2 }}>Enter your email and we'll send you a reset link.</div>
            </div>

            <form onSubmit={submit}>
              {error && (
                <div style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 8, padding: '10px 14px', color: '#f87171', fontSize: 13, marginBottom: 16 }}>
                  {error}
                </div>
              )}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: TEXT2, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 7 }}>Email</label>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  required autoComplete="email"
                  style={{ width: '100%', padding: '11px 14px', background: INPUT, border: BORDER, borderRadius: 8, color: TEXT, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <button type="submit" disabled={loading}
                style={{ width: '100%', padding: 13, background: BLUE, color: '#fff', border: 'none', borderRadius: 9, fontSize: 15, fontWeight: 700, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1 }}>
                {loading ? 'Sending…' : 'Send Reset Link'}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: TEXT2 }}>
              <Link to="/login" style={{ color: BLUE, textDecoration: 'none', fontWeight: 600 }}>Back to sign in</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
