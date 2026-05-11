import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const GOOGLE_CLIENT_ID    = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const APPLE_CLIENT_ID     = import.meta.env.VITE_APPLE_CLIENT_ID;
const MICROSOFT_CLIENT_ID = import.meta.env.VITE_MICROSOFT_CLIENT_ID;

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

const inp = {
  width: '100%', padding: '11px 14px', background: INPUT_BG,
  border: BORDER, borderRadius: 8, color: TEXT, fontSize: 14,
  outline: 'none', boxSizing: 'border-box',
};

const ROLES = [
  { val: 'user',      label: 'Individual', icon: '◎', desc: 'Track your personal finances, investments, and goals.' },
  { val: 'professor', label: 'Professor',  icon: '⊟', desc: 'Manage courses, assignments, and student progress.' },
  { val: 'student',   label: 'Student',    icon: '◫', desc: 'Follow coursework and build real financial skills.' },
];

const HIGHLIGHTS = [
  { icon: '◎', color: '#60a5fa', label: 'Live financial dashboard',     sub: 'Net worth, spending, and investments in real time.' },
  { icon: '◫', color: '#4ade80', label: 'Curriculum-aligned education', sub: 'Real assignments on budgeting, taxes, and investing.' },
  { icon: '⊞', color: '#c084fc', label: 'Professor analytics',          sub: 'Live class progress, submissions, and grades.' },
];

export default function Register() {
  const { login } = useAuth();
  const navigate  = useNavigate();
  const [form, setForm]           = useState({ name: '', email: '', password: '', role: 'user', courseCode: '' });
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [oauthLoading, setOauthLoading] = useState(null);
  const [codeState, setCodeState] = useState(null);
  const codeTimer = useRef(null);
  const googleBtnRef = useRef(null);

  const isEdu         = form.email.toLowerCase().endsWith('.edu');
  const showCodeField = form.role === 'student' || form.role === 'professor' || isEdu;
  const showOAuth     = GOOGLE_CLIENT_ID || APPLE_CLIENT_ID || MICROSOFT_CLIENT_ID;

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
        text: 'signup_with',
        shape: 'rectangular',
        width: googleBtnRef.current.offsetWidth || 380,
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
      setError(err.response?.data?.error || 'Google sign-up failed');
    } finally { setOauthLoading(null); }
  };

  const handleMicrosoft = async () => {
    if (!window.msal?.PublicClientApplication) return setError('Microsoft Sign-In not available');
    setError(''); setOauthLoading('microsoft');
    try {
      const msalApp = new window.msal.PublicClientApplication({
        auth: { clientId: MICROSOFT_CLIENT_ID, authority: 'https://login.microsoftonline.com/common', redirectUri: window.location.origin },
        cache: { cacheLocation: 'sessionStorage', storeAuthStateInCookie: false },
      });
      const result = await msalApp.loginPopup({ scopes: ['openid', 'email', 'profile'] });
      const { data } = await api.post('/auth/microsoft', { id_token: result.idToken });
      login(data.token, data.user);
      navigate('/app');
    } catch (err) {
      if (err?.errorCode !== 'user_cancelled') {
        setError(err?.response?.data?.error || 'Microsoft sign-up failed');
      }
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
        setError(err?.response?.data?.error || 'Apple sign-up failed');
      }
    } finally { setOauthLoading(null); }
  };

  useEffect(() => {
    const raw = form.courseCode.trim().toUpperCase();
    if (!raw) { setCodeState(null); return; }
    setCodeState({ validating: true });
    clearTimeout(codeTimer.current);
    codeTimer.current = setTimeout(async () => {
      try {
        const { data } = await api.post('/auth/validate-code', { code: raw });
        setCodeState({ course: data.course });
      } catch {
        setCodeState({ error: 'Code not found — check with your professor' });
      }
    }, 500);
    return () => clearTimeout(codeTimer.current);
  }, [form.courseCode]);

  useEffect(() => {
    if (codeState?.course && form.role === 'user') setForm(p => ({ ...p, role: 'student' }));
  }, [codeState]);

  const submit = async (e) => {
    e.preventDefault();
    if (form.courseCode.trim() && !codeState?.course) {
      setError('Enter a valid course code or leave it blank'); return;
    }
    setError(''); setLoading(true);
    try {
      const { data } = await api.post('/auth/register', {
        name: form.name, email: form.email, password: form.password,
        role: form.role, courseCode: form.courseCode.trim().toUpperCase() || undefined,
      });
      login(data.token, data.user);
      navigate('/app');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally { setLoading(false); }
  };

  const selectedRole = ROLES.find(r => r.val === form.role);

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
            One platform.<br />Finance, education, and markets.
          </div>
          <div style={{ fontSize: 14, color: L_TEXT2, marginBottom: 48, lineHeight: 1.6 }}>
            Join students, instructors, and individuals building real financial literacy.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {HIGHLIGHTS.map(f => (
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

      {/* ── Right: dark registration form ────────────────── */}
      <div style={{ width: 480, flexShrink: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '48px 48px', background: R_BG, overflowY: 'auto' }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: TEXT, letterSpacing: '-0.5px' }}>Create your account</div>
          <div style={{ fontSize: 14, color: TEXT2, marginTop: 6 }}>
            Signing up as <span style={{ color: TEXT, fontWeight: 600 }}>{selectedRole?.label}</span>
          </div>
        </div>

        {/* OAuth buttons */}
        {showOAuth && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            {GOOGLE_CLIENT_ID && (
              <div ref={googleBtnRef} style={{ width: '100%', minHeight: 44, borderRadius: 8, overflow: 'hidden', opacity: oauthLoading === 'google' ? 0.6 : 1, transition: 'opacity 0.15s' }} />
            )}
            {MICROSOFT_CLIENT_ID && (
              <button onClick={handleMicrosoft} disabled={!!oauthLoading}
                style={{ width: '100%', padding: '11px 14px', background: '#fff', border: 'none', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, cursor: oauthLoading ? 'default' : 'pointer', opacity: oauthLoading === 'microsoft' ? 0.6 : 1, transition: 'opacity 0.15s' }}>
                <svg width="18" height="18" viewBox="0 0 21 21">
                  <rect x="0" y="0" width="10" height="10" fill="#F25022"/>
                  <rect x="11" y="0" width="10" height="10" fill="#7FBA00"/>
                  <rect x="0" y="11" width="10" height="10" fill="#00A4EF"/>
                  <rect x="11" y="11" width="10" height="10" fill="#FFB900"/>
                </svg>
                <span style={{ fontSize: 15, fontWeight: 600, color: '#000' }}>
                  {oauthLoading === 'microsoft' ? 'Signing up…' : 'Continue with Microsoft'}
                </span>
              </button>
            )}
            {APPLE_CLIENT_ID && (
              <button onClick={handleApple} disabled={!!oauthLoading}
                style={{ width: '100%', padding: '11px 14px', background: '#fff', border: 'none', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, cursor: oauthLoading ? 'default' : 'pointer', opacity: oauthLoading === 'apple' ? 0.6 : 1, transition: 'opacity 0.15s' }}>
                <svg width="18" height="18" viewBox="0 0 814 1000" fill="#000">
                  <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-42.6-168.3-127.6C36 440.8 0 352.3 0 269.4c0-175.2 114.4-267.7 226.7-267.7 59.8 0 109.6 39.5 147.2 39.5 35.9 0 92.4-42.1 160.3-42.1 25.5 0 108.2 2.6 168.4 74.2z" />
                </svg>
                <span style={{ fontSize: 15, fontWeight: 600, color: '#000' }}>
                  {oauthLoading === 'apple' ? 'Signing up…' : 'Continue with Apple'}
                </span>
              </button>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0' }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
              <span style={{ fontSize: 12, color: TEXT3 }}>or sign up with email</span>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
            </div>
          </div>
        )}

        {/* Role selector */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {ROLES.map(r => {
            const active = form.role === r.val;
            const color  = r.val === 'professor' ? '#4ade80' : r.val === 'student' ? '#c084fc' : '#0066f5';
            return (
              <button key={r.val} type="button" onClick={() => setForm(p => ({ ...p, role: r.val }))}
                style={{ flex: 1, padding: '10px 8px', borderRadius: 8, border: active ? `1.5px solid ${color}` : BORDER, background: active ? `${color}12` : INPUT_BG, cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s' }}>
                <div style={{ fontSize: 16, marginBottom: 3 }}>{r.icon}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: active ? color : TEXT2 }}>{r.label}</div>
              </button>
            );
          })}
        </div>

        <form onSubmit={submit}>
          {error && (
            <div style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 8, padding: '10px 14px', color: '#f87171', fontSize: 13, marginBottom: 20 }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: TEXT2, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 7 }}>Full Name</label>
            <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required style={inp} />
          </div>

          <div style={{ marginBottom: 6 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: TEXT2, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 7 }}>Email</label>
            <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required autoComplete="email" style={inp} />
          </div>
          {isEdu
            ? <div style={{ marginBottom: 14, fontSize: 12, color: '#4ade80', display: 'flex', alignItems: 'center', gap: 5 }}>✓ Student email — you qualify for the student discount</div>
            : <div style={{ marginBottom: 14 }} />
          }

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: TEXT2, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 7 }}>
              Password <span style={{ color: TEXT3, fontWeight: 400, textTransform: 'none' }}>(min. 8 characters)</span>
            </label>
            <input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} required autoComplete="new-password" style={inp} />
          </div>

          {showCodeField && (
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: TEXT2, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 7 }}>
                Course Code <span style={{ color: TEXT3, fontWeight: 400, textTransform: 'none' }}>(optional)</span>
              </label>
              <input
                type="text" placeholder="e.g. B-TERRY-26" value={form.courseCode}
                onChange={e => setForm(p => ({ ...p, courseCode: e.target.value }))}
                style={{ ...inp, textTransform: 'uppercase', letterSpacing: '1px',
                  border: codeState?.course ? '1px solid rgba(74,222,128,0.5)' : codeState?.error ? '1px solid rgba(248,113,113,0.5)' : BORDER }}
              />
              {codeState?.validating && <div style={{ marginTop: 6, fontSize: 12, color: TEXT3 }}>Checking code…</div>}
              {codeState?.course && (
                <div style={{ marginTop: 8, padding: '8px 12px', background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 7 }}>
                  <div style={{ fontSize: 12, color: '#4ade80', fontWeight: 700, marginBottom: 2 }}>✓ Valid code</div>
                  <div style={{ fontSize: 12, color: TEXT2 }}>{codeState.course.course_name} · {codeState.course.instructor_name} · {codeState.course.semester}</div>
                </div>
              )}
              {codeState?.error && <div style={{ marginTop: 6, fontSize: 12, color: '#f87171' }}>{codeState.error}</div>}
            </div>
          )}

          <button type="submit" disabled={loading}
            style={{ width: '100%', padding: '13px', background: BLUE_BTN, color: '#fff', border: 'none', borderRadius: 9, fontSize: 15, fontWeight: 700, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1, marginTop: 4 }}>
            {loading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: TEXT2 }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: BLUE_BTN, textDecoration: 'none', fontWeight: 600 }}>Sign in</Link>
        </div>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: TEXT3, lineHeight: 1.6 }}>
          By creating an account you agree to our{' '}
          <Link to="/terms" style={{ color: TEXT3, textDecoration: 'underline' }}>Terms of Service</Link>{' '}
          and{' '}
          <Link to="/privacy" style={{ color: TEXT3, textDecoration: 'underline' }}>Privacy Policy</Link>.
        </div>
      </div>

    </div>
  );
}
