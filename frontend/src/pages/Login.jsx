import React, { useState, useEffect, useRef } from 'react';
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
const BLUE_BTN = '#0066f5';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const APPLE_CLIENT_ID  = import.meta.env.VITE_APPLE_CLIENT_ID;

const FEATURES = [
  { icon: '◎', color: '#60a5fa', label: 'Live financial dashboard',     sub: 'Net worth, spending, and investments in one place.' },
  { icon: '◫', color: '#4ade80', label: 'Curriculum-aligned education', sub: 'Assignments built around real personal finance decisions.' },
  { icon: '⊞', color: '#c084fc', label: 'Professor analytics',          sub: 'Track submissions, grades, and class progress in real time.' },
  { icon: '◈', color: '#fbbf24', label: 'Live market data',             sub: 'S&P 500, fear & greed index, yield curve, and more.' },
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm]         = useState({ email: '', password: '' });
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [oauthLoading, setOauthLoading] = useState(null); // 'google' | 'apple' | null
  const googleBtnRef = useRef(null);

  // Initialize Google Sign-In button
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !googleBtnRef.current) return;
    const init = () => {
      if (!window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCredential,
      });
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: 'filled_black',
        size: 'large',
        text: 'signin_with',
        shape: 'rectangular',
        width: googleBtnRef.current.offsetWidth || 364,
      });
    };
    if (window.google?.accounts?.id) { init(); }
    else {
      const script = document.querySelector('script[src*="accounts.google.com/gsi/client"]');
      if (script) script.addEventListener('load', init);
    }
  }, []);

  const handleGoogleCredential = async ({ credential }) => {
    setError(''); setOauthLoading('google');
    try {
      const { data } = await api.post('/auth/google', { credential });
      login(data.token, data.user);
      navigate('/app');
    } catch (err) {
      setError(err.response?.data?.error || 'Google sign-in failed');
    } finally { setOauthLoading(null); }
  };

  const handleApple = async () => {
    if (!window.AppleID?.auth) return setError('Apple Sign-In not available');
    setError(''); setOauthLoading('apple');
    try {
      window.AppleID.auth.init({
        clientId: APPLE_CLIENT_ID,
        scope: 'name email',
        redirectURI: window.location.origin,
        usePopup: true,
      });
      const response = await window.AppleID.auth.signIn();
      const id_token = response.authorization?.id_token;
      const appleUser = response.user;
      const name = appleUser ? `${appleUser.name?.firstName || ''} ${appleUser.name?.lastName || ''}`.trim() : undefined;
      const { data } = await api.post('/auth/apple', { id_token, name });
      login(data.token, data.user);
      navigate('/app');
    } catch (err) {
      if (err?.error !== 'popup_closed_by_user') {
        setError(err?.response?.data?.error || 'Apple sign-in failed');
      }
    } finally { setOauthLoading(null); }
  };

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

  const showOAuth = GOOGLE_CLIENT_ID || APPLE_CLIENT_ID;

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
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: TEXT, letterSpacing: '-0.5px' }}>Welcome back</div>
          <div style={{ fontSize: 14, color: TEXT2, marginTop: 6 }}>Sign in to your account</div>
        </div>

        {/* OAuth buttons */}
        {showOAuth && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
            {GOOGLE_CLIENT_ID && (
              <div ref={googleBtnRef} style={{ width: '100%', minHeight: 44, borderRadius: 8, overflow: 'hidden', opacity: oauthLoading === 'google' ? 0.6 : 1, transition: 'opacity 0.15s' }} />
            )}
            {APPLE_CLIENT_ID && (
              <button onClick={handleApple} disabled={!!oauthLoading}
                style={{ width: '100%', padding: '11px 14px', background: '#fff', border: 'none', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, cursor: oauthLoading ? 'default' : 'pointer', opacity: oauthLoading === 'apple' ? 0.6 : 1, transition: 'opacity 0.15s' }}>
                <svg width="18" height="18" viewBox="0 0 814 1000" fill="#000">
                  <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-42.6-168.3-127.6C36 440.8 0 352.3 0 269.4c0-175.2 114.4-267.7 226.7-267.7 59.8 0 109.6 39.5 147.2 39.5 35.9 0 92.4-42.1 160.3-42.1 25.5 0 108.2 2.6 168.4 74.2z" />
                </svg>
                <span style={{ fontSize: 15, fontWeight: 600, color: '#000' }}>
                  {oauthLoading === 'apple' ? 'Signing in…' : 'Sign in with Apple'}
                </span>
              </button>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0' }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
              <span style={{ fontSize: 12, color: TEXT3 }}>or continue with email</span>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
            </div>
          </div>
        )}

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

          <button type="submit" disabled={loading || !!oauthLoading}
            style={{ width: '100%', padding: '13px', background: BLUE_BTN, color: '#fff', border: 'none', borderRadius: 9, fontSize: 15, fontWeight: 700, cursor: (loading || oauthLoading) ? 'default' : 'pointer', opacity: (loading || oauthLoading) ? 0.7 : 1, marginTop: 4 }}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
          <div style={{ textAlign: 'right', marginTop: 10 }}>
            <Link to="/forgot-password" style={{ fontSize: 12, color: TEXT2, textDecoration: 'none' }}>Forgot password?</Link>
          </div>
        </form>

        <div style={{ textAlign: 'center', marginTop: 28, fontSize: 13, color: TEXT2 }}>
          Don't have an account?{' '}
          <Link to="/register" style={{ color: BLUE_BTN, textDecoration: 'none', fontWeight: 600 }}>Create one</Link>
        </div>

        <div style={{ textAlign: 'center', marginTop: 32, fontSize: 11, color: TEXT3 }}>
          <Link to="/privacy" style={{ color: TEXT3, textDecoration: 'none' }}>Privacy Policy</Link>
          {' · '}
          <Link to="/terms" style={{ color: TEXT3, textDecoration: 'none' }}>Terms of Service</Link>
        </div>
      </div>

    </div>
  );
}
