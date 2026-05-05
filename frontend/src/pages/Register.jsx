import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const BG       = '#0f0f0f';
const CARD_BG  = '#1c1c1e';
const BORDER   = '1px solid #2a2a2a';
const TEXT     = '#f0f0f0';
const TEXT2    = '#8e8e93';
const TEXT3    = '#555';
const GREEN    = '#4ade80';
const BLUE     = '#4da3ff';
const BLUE_BTN = '#0066f5';
const RED      = '#f87171';

const inp = {
  width: '100%', padding: '11px 14px', background: '#111',
  border: BORDER, borderRadius: 8, color: TEXT, fontSize: 14,
  outline: 'none', boxSizing: 'border-box',
};

const ROLES = [
  { val: 'user',      label: 'Individual', icon: '◎', desc: 'Track your personal finances, investments, and goals.' },
  { val: 'professor', label: 'Professor',  icon: '⊟', desc: 'Manage courses, assignments, and student progress.' },
  { val: 'student',   label: 'Student',    icon: '◫', desc: 'Follow coursework and build real financial skills.' },
];

export default function Register() {
  const { login } = useAuth();
  const navigate  = useNavigate();
  const [form, setForm]         = useState({ name: '', email: '', password: '', role: 'user', courseCode: '' });
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [codeState, setCodeState] = useState(null);
  const codeTimer = useRef(null);

  const isEdu       = form.email.toLowerCase().endsWith('.edu');
  const showCodeField = form.role === 'student' || form.role === 'professor' || isEdu;

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
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

      {/* ── Left: brand + role preview ───────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '60px 64px', borderRight: BORDER, minWidth: 0 }}>
        <div style={{ maxWidth: 440 }}>
          <div style={{ marginBottom: 48 }}>
            <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-1.5px', color: TEXT }}>PeakLedger</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: TEXT2, marginTop: 10, letterSpacing: '-0.3px', lineHeight: 1.4 }}>
              One platform.<br />Finance, education, and markets.
            </div>
          </div>

          {/* Role cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {ROLES.map(r => {
              const active = form.role === r.val;
              const color  = r.val === 'professor' ? GREEN : r.val === 'student' ? '#a78bfa' : BLUE;
              return (
                <button key={r.val} type="button" onClick={() => setForm(p => ({ ...p, role: r.val }))}
                  style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: '14px 16px', borderRadius: 10, border: active ? `1px solid ${color}40` : BORDER, background: active ? `${color}0a` : 'transparent', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: active ? `${color}18` : 'rgba(255,255,255,0.04)', border: `1px solid ${active ? color + '40' : '#333'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, color: active ? color : TEXT3, flexShrink: 0 }}>
                    {r.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: active ? color : TEXT, marginBottom: 2 }}>{r.label}</div>
                    <div style={{ fontSize: 12, color: TEXT2, lineHeight: 1.5 }}>{r.desc}</div>
                  </div>
                  {active && <div style={{ marginLeft: 'auto', fontSize: 16, color, flexShrink: 0, alignSelf: 'center' }}>✓</div>}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Right: registration form ──────────────────────── */}
      <div style={{ width: 440, flexShrink: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '60px 48px' }}>
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: TEXT, letterSpacing: '-0.5px' }}>Create your account</div>
          <div style={{ fontSize: 14, color: TEXT2, marginTop: 6 }}>
            Signing up as <span style={{ color: TEXT, fontWeight: 600 }}>{selectedRole?.label}</span>
          </div>
        </div>

        <form onSubmit={submit}>
          {error && (
            <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 8, padding: '10px 14px', color: RED, fontSize: 13, marginBottom: 20 }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: TEXT2, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Full Name</label>
            <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required style={inp} />
          </div>

          <div style={{ marginBottom: 6 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: TEXT2, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Email</label>
            <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required autoComplete="email" style={inp} />
          </div>
          {isEdu
            ? <div style={{ marginBottom: 14, fontSize: 12, color: GREEN, display: 'flex', alignItems: 'center', gap: 5 }}>✓ Student email — you qualify for the student discount</div>
            : <div style={{ marginBottom: 14 }} />
          }

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: TEXT2, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
              Password <span style={{ color: TEXT3, fontWeight: 400, textTransform: 'none' }}>(min. 8 characters)</span>
            </label>
            <input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} required autoComplete="new-password" style={inp} />
          </div>

          {showCodeField && (
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: TEXT2, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                Course Code <span style={{ color: TEXT3, fontWeight: 400, textTransform: 'none' }}>(optional)</span>
              </label>
              <input
                type="text" placeholder="e.g. B-TERRY-26" value={form.courseCode}
                onChange={e => setForm(p => ({ ...p, courseCode: e.target.value }))}
                style={{ ...inp, textTransform: 'uppercase', letterSpacing: '1px',
                  border: codeState?.course ? '1px solid rgba(74,222,128,0.5)' : codeState?.error ? '1px solid rgba(248,113,113,0.4)' : BORDER }}
              />
              {codeState?.validating && <div style={{ marginTop: 6, fontSize: 12, color: TEXT3 }}>Checking code…</div>}
              {codeState?.course && (
                <div style={{ marginTop: 8, padding: '8px 12px', background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 7 }}>
                  <div style={{ fontSize: 12, color: GREEN, fontWeight: 700, marginBottom: 2 }}>✓ Valid code</div>
                  <div style={{ fontSize: 12, color: TEXT2 }}>{codeState.course.course_name} · {codeState.course.instructor_name} · {codeState.course.semester}</div>
                </div>
              )}
              {codeState?.error && <div style={{ marginTop: 6, fontSize: 12, color: RED }}>{codeState.error}</div>}
            </div>
          )}

          <button type="submit" disabled={loading}
            style={{ width: '100%', padding: '13px', background: BLUE_BTN, color: '#fff', border: 'none', borderRadius: 9, fontSize: 15, fontWeight: 700, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1, marginTop: 4 }}>
            {loading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 28, fontSize: 13, color: TEXT2 }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: BLUE, textDecoration: 'none', fontWeight: 600 }}>Sign in</Link>
        </div>

      </div>

    </div>
  );
}
