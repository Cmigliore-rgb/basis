import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';

const BG     = '#0a0a0a';
const TEXT   = '#f1f5f9';
const TEXT2  = '#94a3b8';
const BORDER = '1px solid rgba(255,255,255,0.08)';
const INPUT  = '#141414';
const BLUE   = '#0066f5';

export default function ResetPassword() {
  const navigate = useNavigate();
  const token = new URLSearchParams(window.location.search).get('token');

  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [done, setDone]           = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');

  if (!token) {
    return (
      <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '-apple-system,sans-serif' }}>
        <div style={{ textAlign: 'center', color: TEXT2 }}>
          <div style={{ fontSize: 14, marginBottom: 16 }}>Invalid or missing reset link.</div>
          <Link to="/forgot-password" style={{ color: BLUE, textDecoration: 'none', fontWeight: 600, fontSize: 13 }}>Request a new one</Link>
        </div>
      </div>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    if (password !== confirm) { setError('Passwords do not match'); return; }
    setError(''); setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 36, justifyContent: 'center' }}>
          <img src="/logo-icon.png?v=7" alt="" style={{ width: 36, height: 36, borderRadius: 8 }} />
          <span style={{ fontSize: 20, fontWeight: 700, color: TEXT }}>PeakLedger</span>
        </div>

        {done ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>✓</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: TEXT, marginBottom: 8 }}>Password updated</div>
            <div style={{ fontSize: 14, color: TEXT2, marginBottom: 28 }}>You can now sign in with your new password.</div>
            <button onClick={() => navigate('/login')}
              style={{ padding: '12px 28px', background: BLUE, color: '#fff', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              Sign In
            </button>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: TEXT, marginBottom: 6 }}>Set a new password</div>
              <div style={{ fontSize: 14, color: TEXT2 }}>Must be at least 8 characters.</div>
            </div>

            <form onSubmit={submit}>
              {error && (
                <div style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 8, padding: '10px 14px', color: '#f87171', fontSize: 13, marginBottom: 16 }}>
                  {error}
                </div>
              )}
              {[
                { label: 'New Password',      val: password, set: setPassword },
                { label: 'Confirm Password',  val: confirm,  set: setConfirm  },
              ].map(f => (
                <div key={f.label} style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: TEXT2, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 7 }}>{f.label}</label>
                  <input
                    type="password" value={f.val} onChange={e => f.set(e.target.value)}
                    required minLength={8} autoComplete="new-password"
                    style={{ width: '100%', padding: '11px 14px', background: INPUT, border: BORDER, borderRadius: 8, color: TEXT, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              ))}
              <button type="submit" disabled={loading}
                style={{ width: '100%', padding: 13, background: BLUE, color: '#fff', border: 'none', borderRadius: 9, fontSize: 15, fontWeight: 700, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1, marginTop: 4 }}>
                {loading ? 'Updating…' : 'Update Password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
