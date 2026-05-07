import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const L_BG    = '#0f172a';
const L_TEXT  = '#f1f5f9';
const L_TEXT2 = '#94a3b8';

const R_BG    = '#0a0a0a';
const TEXT    = '#f1f5f9';
const TEXT2   = '#94a3b8';
const TEXT3   = '#475569';
const BORDER  = '1px solid rgba(255,255,255,0.08)';
const INPUT_BG = '#141414';
const BLUE    = '#2563eb';
const BLUE_BTN = '#0066f5';
const GREEN   = '#16a34a';
const RED     = '#dc2626';

const FEATURES = [
  { icon: '◎', color: '#60a5fa', label: 'Live financial dashboard',     sub: 'Net worth, spending, investments — all in one place.' },
  { icon: '◫', color: '#4ade80', label: 'Curriculum-aligned education', sub: 'Assignments built around real personal finance decisions.' },
  { icon: '⊞', color: '#c084fc', label: 'Professor analytics',          sub: 'Track submissions, grades, and class progress in real time.' },
  { icon: '◈', color: '#fbbf24', label: 'Live market data',             sub: 'S&P 500, fear & greed index, yield curve, and more.' },
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm]       = useState({ email: '', password: '' });
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const { data } = await api.post('/auth/login', form);
      login(data.token, data.user);
      navigate('/app');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

      {/* ── Left: dark brand panel ─────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '60px 64px', background: L_BG, minWidth: 0 }}>
        <div style={{ maxWidth: 440 }}>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 40 }}>
            <img src="/logo-icon.svg" alt="" style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0 }} />
            <span style={{ fontSize: 26, fontWeight: 700, color: L_TEXT, letterSpacing: '-0.5px' }}>PeakLedger</span>
          </div>

          <div style={{ fontSize: 22, fontWeight: 700, color: L_TEXT, letterSpacing: '-0.5px', marginBottom: 8, lineHeight: 1.3 }}>
            Personal finance,<br />inside the classroom.
          </div>
          <div style={{ fontSize: 14, color: L_TEXT2, marginBottom: 48, lineHeight: 1.6 }}>
            Connect your accounts, work through real assignments, and build financial literacy with data that matters.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {FEATURES.map(f => (
              <div key={f.label} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: `${f.color}18`, border: `1px solid ${f.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, color: f.color, flexShrink: 0 }}>
                  {f.icon}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: L_TEXT }}>{f.label}</div>
                  <div style={{ fontSize: 12, color: L_TEXT2, marginTop: 2, lineHeight: 1.5 }}>{f.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right: dark login form ────────────────────────── */}
      <div style={{ width: 460, flexShrink: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '60px 48px', background: R_BG }}>
        <div style={{ marginBottom: 36 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: TEXT, letterSpacing: '-0.5px' }}>Welcome back</div>
          <div style={{ fontSize: 14, color: TEXT2, marginTop: 6 }}>Sign in to your account</div>
        </div>

        <form onSubmit={submit}>
          {error && (
            <div style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 8, padding: '10px 14px', color: '#f87171', fontSize: 13, marginBottom: 20 }}>
              {error}
            </div>
          )}

          {[{ label: 'Email', key: 'email', type: 'email' }, { label: 'Password', key: 'password', type: 'password' }].map(f => (
            <div key={f.key} style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: TEXT2, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 7 }}>{f.label}</label>
              <input
                type={f.type} value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                required autoComplete={f.key === 'password' ? 'current-password' : 'email'}
                style={{ width: '100%', padding: '11px 14px', background: INPUT_BG, border: BORDER, borderRadius: 8, color: TEXT, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
          ))}

          <button type="submit" disabled={loading}
            style={{ width: '100%', padding: '13px', background: BLUE_BTN, color: '#fff', border: 'none', borderRadius: 9, fontSize: 15, fontWeight: 700, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1, marginTop: 4 }}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 28, fontSize: 13, color: TEXT2 }}>
          Don't have an account?{' '}
          <Link to="/register" style={{ color: BLUE_BTN, textDecoration: 'none', fontWeight: 600 }}>Create one</Link>
        </div>
      </div>

    </div>
  );
}
