import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const GOOGLE_CLIENT_ID    = import.meta.env.VITE_GOOGLE_CLIENT_ID;
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

function pwStrength(pwd) {
  if (!pwd) return 0;
  let s = 0;
  if (pwd.length >= 8) s++;
  if (pwd.length >= 12) s++;
  if (/[A-Z]/.test(pwd)) s++;
  if (/[0-9]/.test(pwd)) s++;
  if (/[^A-Za-z0-9]/.test(pwd)) s++;
  return s;
}

const STRENGTH_LABELS = ['', 'Too weak', 'Weak', 'Fair', 'Good', 'Strong'];
const STRENGTH_COLORS = ['', '#ef4444', '#f97316', '#fbbf24', '#22c55e', '#16a34a'];

export default function Register() {
  const { login } = useAuth();
  const navigate  = useNavigate();
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  const [form, setForm] = useState({
    name: '', email: '', password: '', confirmPassword: '',
    role: 'user', courseCode: '', professorCode: '',
  });
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [codeState, setCodeState] = useState(null);
  const codeTimer = useRef(null);

  // Post-registration "check email" state
  const [pendingEmail, setPendingEmail] = useState(null);
  const [regToken, setRegToken]         = useState(null);
  const [resendState, setResendState]   = useState(null);

  const strength     = pwStrength(form.password);
  const strengthColor = STRENGTH_COLORS[strength] || '#444';
  const strengthLabel = STRENGTH_LABELS[strength] || '';

  const isEdu         = form.email.toLowerCase().endsWith('.edu');
  const showCodeField = form.role === 'student' || isEdu;
  const showOAuth     = GOOGLE_CLIENT_ID || MICROSOFT_CLIENT_ID;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthError = params.get('ms_error') || params.get('google_error');
    if (oauthError) setError(oauthError);
  }, []);

  const handleGoogle = () => {
    const redirectUri = `${window.location.origin}/auth/google/callback`;
    const nonce = Math.random().toString(36).slice(2);
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&response_type=id_token&scope=openid%20email%20profile&nonce=${nonce}&redirect_uri=${encodeURIComponent(redirectUri)}&response_mode=fragment`;
  };

  const handleMicrosoft = () => {
    const redirectUri = `${window.location.origin}/auth/microsoft/callback`;
    const nonce = Math.random().toString(36).slice(2);
    window.location.href = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${MICROSOFT_CLIENT_ID}&response_type=id_token&scope=openid%20email%20profile&nonce=${nonce}&redirect_uri=${encodeURIComponent(redirectUri)}&response_mode=fragment`;
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
        setCodeState({ error: 'Code not found, check with your professor' });
      }
    }, 500);
    return () => clearTimeout(codeTimer.current);
  }, [form.courseCode]);

  useEffect(() => {
    if (codeState?.course && form.role === 'user') setForm(p => ({ ...p, role: 'student' }));
  }, [codeState]);

  const submit = async (e) => {
    e.preventDefault();

    // Client-side password validation
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters'); return;
    }
    if (!/[^A-Za-z0-9]/.test(form.password)) {
      setError('Password must contain at least one special character (e.g. ! @ # $ %)'); return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match'); return;
    }
    if (form.courseCode.trim() && !codeState?.course) {
      setError('Enter a valid course code or leave it blank'); return;
    }

    setError(''); setLoading(true);
    try {
      const { data } = await api.post('/auth/register', {
        name: form.name, email: form.email, password: form.password,
        role: form.role, courseCode: form.courseCode.trim().toUpperCase() || undefined,
        professorCode: form.professorCode || undefined,
      });

      if (data.user.email_verified) {
        // Admins and professors are auto-verified, log in immediately
        login(data.token, data.user);
        navigate('/app');
      } else {
        // Everyone else: must verify email before accessing the app
        setPendingEmail(form.email);
        setRegToken(data.token);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally { setLoading(false); }
  };

  const resendVerification = async () => {
    setResendState('sending');
    try {
      await axios.post('/api/auth/resend-verification', {}, {
        headers: { Authorization: `Bearer ${regToken}` },
      });
      setResendState('sent');
    } catch {
      setResendState('error');
    }
  };

  // Check email screen
  if (pendingEmail) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: R_BG, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', padding: 24 }}>
        <div style={{ maxWidth: 420, width: '100%', textAlign: 'center' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(37,99,235,0.12)', border: '1px solid rgba(59,130,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, margin: '0 auto 24px' }}>
            ✉
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: TEXT, marginBottom: 10, letterSpacing: '-0.5px' }}>Check your email</div>
          <div style={{ fontSize: 14, color: TEXT2, lineHeight: 1.7, marginBottom: 28 }}>
            We sent a verification link to{' '}
            <span style={{ color: TEXT, fontWeight: 600 }}>{pendingEmail}</span>.
            Click the link to verify your account and sign in.
          </div>
          <div style={{ fontSize: 13, color: TEXT3, marginBottom: 20 }}>
            Didn't receive it? Check your spam folder.
          </div>
          {resendState !== 'sent' ? (
            <button
              onClick={resendVerification}
              disabled={resendState === 'sending'}
              style={{ padding: '10px 24px', background: 'rgba(37,99,235,0.12)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 8, color: '#60a5fa', fontSize: 13, fontWeight: 600, cursor: resendState === 'sending' ? 'default' : 'pointer', opacity: resendState === 'sending' ? 0.7 : 1, marginBottom: 20 }}>
              {resendState === 'sending' ? 'Sending...' : 'Resend verification email'}
            </button>
          ) : (
            <div style={{ fontSize: 13, color: '#4ade80', marginBottom: 20 }}>Sent! Check your inbox.</div>
          )}
          {resendState === 'error' && (
            <div style={{ fontSize: 12, color: '#f87171', marginBottom: 12 }}>Failed to resend. Try again shortly.</div>
          )}
          <div style={{ fontSize: 13, color: TEXT3 }}>
            <Link to="/login" style={{ color: BLUE_BTN, textDecoration: 'none', fontWeight: 600 }}>Back to sign in</Link>
          </div>
        </div>
      </div>
    );
  }

  const selectedRole = ROLES.find(r => r.val === form.role);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

      {/* Left: dark brand panel */}
      <div style={{ flex: 1, display: isMobile ? 'none' : 'flex', flexDirection: 'column', justifyContent: 'center', padding: '60px 64px', background: L_BG, minWidth: 0 }}>
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

      {/* Right: registration form */}
      <div style={{ width: isMobile ? '100%' : 480, flexShrink: 0, display: 'flex', flexDirection: 'column', justifyContent: isMobile ? 'flex-start' : 'center', padding: isMobile ? '48px 24px 40px' : '48px 48px', background: R_BG, overflowY: 'auto', minHeight: '100vh' }}>
        {isMobile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
            <img src="/logo-icon.svg" alt="" style={{ width: 32, height: 32, borderRadius: 8 }} />
            <span style={{ fontSize: 20, fontWeight: 700, color: TEXT, letterSpacing: '-0.5px' }}>PeakLedger</span>
          </div>
        )}
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
              <button onClick={handleGoogle}
                style={{ width: '100%', padding: '11px 14px', background: '#fff', border: 'none', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, cursor: 'pointer' }}>
                <svg width="18" height="18" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
                <span style={{ fontSize: 15, fontWeight: 600, color: '#000' }}>Continue with Google</span>
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
                <span style={{ fontSize: 15, fontWeight: 600, color: '#000' }}>Continue with Microsoft</span>
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
            ? <div style={{ marginBottom: 14, fontSize: 12, color: '#4ade80', display: 'flex', alignItems: 'center', gap: 5 }}>✓ Student email, you qualify for the student discount</div>
            : <div style={{ marginBottom: 14 }} />
          }

          {/* Password */}
          <div style={{ marginBottom: 8 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: TEXT2, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 7 }}>Password</label>
            <input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} required autoComplete="new-password" style={inp} />
          </div>

          {/* Strength bar */}
          {form.password.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= strength ? strengthColor : 'rgba(255,255,255,0.1)', transition: 'background 0.2s' }} />
                ))}
              </div>
              <div style={{ fontSize: 11, color: strengthColor, fontWeight: 600 }}>{strengthLabel}</div>
            </div>
          )}

          {/* Password requirements */}
          <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {[
              { ok: form.password.length >= 8,          label: 'At least 8 characters' },
              { ok: /[^A-Za-z0-9]/.test(form.password), label: 'At least one special character (! @ # $ % ...)' },
            ].map(({ ok, label }) => (
              <div key={label} style={{ fontSize: 11, color: ok ? '#4ade80' : TEXT3, display: 'flex', alignItems: 'center', gap: 5 }}>
                <span>{ok ? '✓' : '○'}</span> {label}
              </div>
            ))}
          </div>

          {/* Confirm Password */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: TEXT2, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 7 }}>Confirm Password</label>
            <input
              type="password" value={form.confirmPassword}
              onChange={e => setForm(p => ({ ...p, confirmPassword: e.target.value }))}
              required autoComplete="new-password"
              style={{ ...inp, border: form.confirmPassword && form.confirmPassword !== form.password ? '1px solid rgba(248,113,113,0.5)' : form.confirmPassword && form.confirmPassword === form.password ? '1px solid rgba(74,222,128,0.4)' : BORDER }}
            />
            {form.confirmPassword && form.confirmPassword !== form.password && (
              <div style={{ marginTop: 5, fontSize: 11, color: '#f87171' }}>Passwords do not match</div>
            )}
            {form.confirmPassword && form.confirmPassword === form.password && (
              <div style={{ marginTop: 5, fontSize: 11, color: '#4ade80' }}>✓ Passwords match</div>
            )}
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

          {form.role === 'professor' && (
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: TEXT2, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 7 }}>
                Professor Access Code
              </label>
              <input
                type="text" placeholder="Enter your access code" value={form.professorCode}
                onChange={e => setForm(p => ({ ...p, professorCode: e.target.value }))}
                style={{ ...inp, border: BORDER }}
              />
              <div style={{ marginTop: 6, fontSize: 12, color: TEXT3 }}>Contact your institution or PeakLedger to get an access code.</div>
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
