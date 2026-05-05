import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const BG      = '#0f0f0f';
const CARD_BG = '#1c1c1e';
const BORDER  = '1px solid #2a2a2a';
const TEXT    = '#f0f0f0';
const TEXT2   = '#8e8e93';
const TEXT3   = '#555';
const GREEN   = '#4ade80';
const BLUE    = '#4da3ff';
const BLUE_BTN = '#0066f5';
const RED     = '#f87171';

const FEATURES = [
  { icon: '◎', color: BLUE,  label: 'Live financial dashboard',      sub: 'Net worth, spending, investments — all in one place.' },
  { icon: '◫', color: GREEN, label: 'Curriculum-aligned education',  sub: 'Assignments built around real personal finance decisions.' },
  { icon: '⊞', color: '#a78bfa', label: 'Professor analytics',      sub: 'Track submissions, grades, and class progress in real time.' },
  { icon: '◈', color: '#fbbf24', label: 'Live market data',         sub: 'S&P 500, fear & greed index, yield curve, and more.' },
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm]     = useState({ email: '', password: '' });
  const [error, setError]   = useState('');
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
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

      {/* ── Left: brand + pitch ───────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '60px 64px', borderRight: BORDER, minWidth: 0 }}>
        <div style={{ maxWidth: 440 }}>
          <div style={{ marginBottom: 48 }}>
            <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-1.5px', color: TEXT }}>PeakLedger</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: TEXT2, marginTop: 10, letterSpacing: '-0.3px', lineHeight: 1.4 }}>
              Personal finance,<br />inside the classroom.
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            {FEATURES.map(f => (
              <div key={f.label} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: `${f.color}14`, border: `1px solid ${f.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: f.color, flexShrink: 0 }}>
                  {f.icon}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: TEXT }}>{f.label}</div>
                  <div style={{ fontSize: 13, color: TEXT2, marginTop: 2, lineHeight: 1.5 }}>{f.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right: login form ─────────────────────────────────────── */}
      <div style={{ width: 440, flexShrink: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '60px 48px' }}>
        <div style={{ marginBottom: 36 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: TEXT, letterSpacing: '-0.5px' }}>Welcome back</div>
          <div style={{ fontSize: 14, color: TEXT2, marginTop: 6 }}>Sign in to your account</div>
        </div>

        <form onSubmit={submit}>
          {error && (
            <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 8, padding: '10px 14px', color: RED, fontSize: 13, marginBottom: 20 }}>
              {error}
            </div>
          )}

          {[{ label: 'Email', key: 'email', type: 'email' }, { label: 'Password', key: 'password', type: 'password' }].map(f => (
            <div key={f.key} style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: TEXT2, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>{f.label}</label>
              <input
                type={f.type} value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                required autoComplete={f.key === 'password' ? 'current-password' : 'email'}
                style={{ width: '100%', padding: '11px 14px', background: '#111', border: BORDER, borderRadius: 8, color: TEXT, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
          ))}

          <button type="submit" disabled={loading} style={{ width: '100%', padding: '13px', background: BLUE_BTN, color: '#fff', border: 'none', borderRadius: 9, fontSize: 15, fontWeight: 700, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1, marginTop: 4 }}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 28, fontSize: 13, color: TEXT2 }}>
          Don't have an account?{' '}
          <Link to="/register" style={{ color: BLUE, textDecoration: 'none', fontWeight: 600 }}>Create one</Link>
        </div>

      </div>

    </div>
  );
}
