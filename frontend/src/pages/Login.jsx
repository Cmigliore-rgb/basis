import React, { useState, useEffect } from 'react';
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

const GOOGLE_CLIENT_ID    = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const MICROSOFT_CLIENT_ID = import.meta.env.VITE_MICROSOFT_CLIENT_ID;

const FEATURES = [
  { icon: '◎', color: '#60a5fa', label: 'Live financial dashboard',     sub: 'Net worth, spending, and investments in one place.' },
  { icon: '◫', color: '#4ade80', label: 'Curriculum-aligned education', sub: 'Assignments built around real personal finance decisions.' },
  { icon: '⊞', color: '#c084fc', label: 'Professor analytics',          sub: 'Track submissions, grades, and class progress in real time.' },
  { icon: '◈', color: '#fbbf24', label: 'Live market data',             sub: 'S&P 500, fear & greed index, yield curve, and more.' },
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  const [form, setForm]         = useState({ email: '', password: '' });
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [twoFactor, setTwoFactor] = useState(null); // { tempToken }
  const [tfCode, setTfCode]     = useState('');
  const [tfLoading, setTfLoading] = useState(false);
  const [verified, setVerified] = useState(false);

  const handleGoogle = () => {
    const redirectUri = `${window.location.origin}/auth/google/callback`;
    const nonce = Math.random().toString(36).slice(2);
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&response_type=id_token&scope=openid%20email%20profile&nonce=${nonce}&redirect_uri=${encodeURIComponent(redirectUri)}&response_mode=fragment`;
    window.location.href = url;
  };

  // Read OAuth errors and verification status from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthError = params.get('ms_error') || params.get('google_error');
    if (oauthError) setError(oauthError);
    if (params.get('verified') === '1') setVerified(true);
  }, []);

  const handleMicrosoft = () => {
    const redirectUri = `${window.location.origin}/auth/microsoft/callback`;
    const nonce = Math.random().toString(36).slice(2);
    const url = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${MICROSOFT_CLIENT_ID}&response_type=id_token&scope=openid%20email%20profile&nonce=${nonce}&redirect_uri=${encodeURIComponent(redirectUri)}&response_mode=fragment`;
    window.location.href = url;
  };


  const submit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const { data } = await api.post('/auth/login', form);
      if (data.requiresTwoFactor) {
        setTwoFactor({ tempToken: data.tempToken });
      } else {
        login(data.token, data.user);
        navigate('/app');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally { setLoading(false); }
  };

  const submitTwoFactor = async (e) => {
    e.preventDefault();
    setError(''); setTfLoading(true);
    try {
      const { data } = await api.post('/auth/verify-2fa', { tempToken: twoFactor.tempToken, code: tfCode });
      login(data.token, data.user);
      navigate('/app');
    } catch (err) {
      setError(err.response?.data?.error || 'Verification failed');
    } finally { setTfLoading(false); }
  };

  const showOAuth = GOOGLE_CLIENT_ID || MICROSOFT_CLIENT_ID;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

      {/* ── Left: dark brand panel ─────────────────────────── */}
      <div style={{ flex: 1, display: isMobile ? 'none' : 'flex', flexDirection: 'column', justifyContent: 'center', padding: '60px 64px', background: L_BG, minWidth: 0 }}>
        <div style={{ maxWidth: 440 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 40 }}>
            <img src="/logo-icon.png?v=7" alt="" style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0 }} />
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
      <div style={{ width: isMobile ? '100%' : 460, flexShrink: 0, display: 'flex', flexDirection: 'column', justifyContent: isMobile ? 'flex-start' : 'center', padding: isMobile ? '48px 24px 40px' : '60px 48px', background: R_BG, minHeight: '100vh', overflowY: 'auto' }}>
        {isMobile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 36 }}>
            <img src="/logo-icon.png?v=7" alt="" style={{ width: 32, height: 32, borderRadius: 8 }} />
            <span style={{ fontSize: 20, fontWeight: 700, color: TEXT, letterSpacing: '-0.5px' }}>PeakLedger</span>
          </div>
        )}

        {/* ── 2FA challenge ── */}
        {twoFactor ? (
          <>
            <div style={{ marginBottom: 32 }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: TEXT, letterSpacing: '-0.5px' }}>Check your email</div>
              <div style={{ fontSize: 14, color: TEXT2, marginTop: 6 }}>We sent a 6-digit code to <strong style={{ color: TEXT }}>{form.email}</strong>. It expires in 10 minutes.</div>
            </div>
            <form onSubmit={submitTwoFactor}>
              {error && (
                <div style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 8, padding: '10px 14px', color: '#f87171', fontSize: 13, marginBottom: 20 }}>
                  {error}
                </div>
              )}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: TEXT2, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 7 }}>Verification Code</label>
                <input
                  type="text" inputMode="numeric" maxLength={6} value={tfCode}
                  onChange={e => setTfCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000" autoFocus
                  style={{ width: '100%', padding: '14px', background: INPUT_BG, border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: TEXT, fontSize: 28, fontWeight: 700, letterSpacing: '10px', textAlign: 'center', outline: 'none', boxSizing: 'border-box', fontFamily: 'monospace' }}
                />
              </div>
              <button type="submit" disabled={tfLoading || tfCode.length < 6}
                style={{ width: '100%', padding: '13px', background: BLUE_BTN, color: '#fff', border: 'none', borderRadius: 9, fontSize: 15, fontWeight: 700, cursor: (tfLoading || tfCode.length < 6) ? 'default' : 'pointer', opacity: (tfLoading || tfCode.length < 6) ? 0.6 : 1 }}>
                {tfLoading ? 'Verifying…' : 'Verify'}
              </button>
              <div style={{ textAlign: 'center', marginTop: 16 }}>
                <button type="button" onClick={() => { setTwoFactor(null); setTfCode(''); setError(''); }}
                  style={{ background: 'none', border: 'none', color: TEXT2, fontSize: 13, cursor: 'pointer' }}>
                  ← Back to sign in
                </button>
              </div>
            </form>
          </>
        ) : (
        <>
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: TEXT, letterSpacing: '-0.5px' }}>Welcome back</div>
          <div style={{ fontSize: 14, color: TEXT2, marginTop: 6 }}>Sign in to your account</div>
        </div>

        {verified && (
          <div style={{ background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: 8, padding: '10px 14px', color: '#4ade80', fontSize: 13, marginBottom: 20 }}>
            ✓ Email verified! You can now sign in.
          </div>
        )}

        {/* OAuth buttons */}
        {showOAuth && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
            {GOOGLE_CLIENT_ID && (
              <button onClick={handleGoogle}
                style={{ width: '100%', padding: '11px 14px', background: '#fff', border: 'none', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, cursor: 'pointer' }}>
                <svg width="18" height="18" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
                <span style={{ fontSize: 15, fontWeight: 600, color: '#000' }}>Sign in with Google</span>
              </button>
            )}
            {MICROSOFT_CLIENT_ID && (
              <button onClick={handleMicrosoft}
                style={{ width: '100%', padding: '11px 14px', background: '#fff', border: 'none', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, cursor: 'pointer' }}>
                <svg width="18" height="18" viewBox="0 0 21 21">
                  <rect x="0" y="0" width="10" height="10" fill="#F25022"/>
                  <rect x="11" y="0" width="10" height="10" fill="#7FBA00"/>
                  <rect x="0" y="11" width="10" height="10" fill="#00A4EF"/>
                  <rect x="11" y="11" width="10" height="10" fill="#FFB900"/>
                </svg>
                <span style={{ fontSize: 15, fontWeight: 600, color: '#000' }}>Sign in with Microsoft</span>
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

          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: TEXT2, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 7 }}>Email</label>
            <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              required autoComplete="email"
              style={{ width: '100%', padding: '11px 14px', background: INPUT_BG, border: BORDER, borderRadius: 8, color: TEXT, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: TEXT2, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 7 }}>Password</label>
            <div style={{ position: 'relative' }}>
              <input type={showPw ? 'text' : 'password'} value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                required autoComplete="current-password"
                style={{ width: '100%', padding: '11px 42px 11px 14px', background: INPUT_BG, border: BORDER, borderRadius: 8, color: TEXT, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
              <button type="button" onClick={() => setShowPw(p => !p)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: TEXT2, fontSize: 14, padding: 0, lineHeight: 1 }}>
                {showPw ? '🙈' : '👁'}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading}
            style={{ width: '100%', padding: '13px', background: BLUE_BTN, color: '#fff', border: 'none', borderRadius: 9, fontSize: 15, fontWeight: 700, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1, marginTop: 4 }}>
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
        </>
        )}
      </div>

    </div>
  );
}
