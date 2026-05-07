import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const BG       = '#0a0a0a';
const CARD     = '#111111';
const BORDER   = 'rgba(255,255,255,0.08)';
const TEXT     = '#f1f5f9';
const TEXT2    = '#94a3b8';
const TEXT3    = '#475569';
const BLUE     = '#2563eb';
const BLUE_BTN = '#0066f5';
const GREEN    = '#4ade80';
const PURPLE   = '#c084fc';
const YELLOW   = '#fbbf24';

const DOWNLOAD_URL = 'https://github.com/Cmigliore-rgb/basis/releases/download/v1.0.0/PeakLedger.Setup.1.0.0.exe';

const FEATURES = [
  {
    icon: '◎', color: '#60a5fa',
    title: 'Live Financial Dashboard',
    desc: 'Connect your accounts and see your net worth, cash flow, spending breakdowns, and investment portfolio update in real time.',
  },
  {
    icon: '◫', color: GREEN,
    title: 'Personal Finance Education',
    desc: 'Work through real assignments on budgeting, tax analysis, and investment modeling tied to actual course curriculum.',
  },
  {
    icon: '⊞', color: PURPLE,
    title: 'Professor Hub',
    desc: 'Instructors get a live view of class progress with submissions, grades, engagement metrics, and one-click feedback.',
  },
  {
    icon: '◈', color: YELLOW,
    title: 'Live Market Data',
    desc: 'S&P 500, sector performance, the fear and greed index, yield curve, and macro indicators all in one panel.',
  },
  {
    icon: '◉', color: '#f87171',
    title: 'Tax Planning Tools',
    desc: 'Model federal tax brackets, compare deductions, and estimate your effective rate across different income scenarios.',
  },
  {
    icon: '⬡', color: '#34d399',
    title: 'Goals and Net Worth Tracking',
    desc: 'Set savings targets, track monthly snapshots, and watch your net worth grow over time with visual progress charts.',
  },
];

const STEPS = [
  { n: '01', title: 'Create your account',   desc: 'Sign up free in under a minute. No credit card required.' },
  { n: '02', title: 'Connect your finances', desc: 'Link bank accounts and investment portfolios securely via Plaid.' },
  { n: '03', title: 'Learn and track',       desc: 'Work through assignments, explore your data, and build real financial literacy.' },
];

export default function Landing() {
  const { user } = useAuth();
  const navigate  = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (user) navigate('/app', { replace: true });
  }, [user]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div style={{ background: BG, color: TEXT, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', minHeight: '100vh' }}>

      {/* Navbar */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        padding: '0 40px', height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: scrolled ? 'rgba(10,10,10,0.92)' : 'transparent',
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
        borderBottom: scrolled ? `1px solid ${BORDER}` : 'none',
        transition: 'all 0.2s',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/logo-icon.svg" alt="" style={{ width: 32, height: 32, borderRadius: 8 }} />
          <span style={{ fontSize: 20, fontWeight: 700, color: TEXT, letterSpacing: '-0.5px' }}>PeakLedger</span>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={() => navigate('/login')}
            style={{ padding: '8px 18px', background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT2, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
            Sign In
          </button>
          <a href={DOWNLOAD_URL} download
            style={{ padding: '8px 18px', background: BLUE_BTN, borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
            Download
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '120px 24px 80px', position: 'relative', overflow: 'hidden' }}>
        {/* Blue radial glow */}
        <div style={{ position: 'absolute', top: '35%', left: '50%', transform: 'translate(-50%, -50%)', width: 800, height: 600, background: 'radial-gradient(ellipse, rgba(37,99,235,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 14px', background: 'rgba(37,99,235,0.12)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 20, fontSize: 12, fontWeight: 600, color: '#60a5fa', marginBottom: 28, letterSpacing: '0.3px' }}>
          Free to use · No credit card required
        </div>

        <h1 style={{ fontSize: 'clamp(40px, 7vw, 76px)', fontWeight: 800, letterSpacing: '-3px', lineHeight: 1.05, margin: '0 0 24px', maxWidth: 820, color: TEXT }}>
          Your finances,<br />
          <span style={{ color: BLUE_BTN }}>finally in focus.</span>
        </h1>

        <p style={{ fontSize: 'clamp(16px, 2vw, 19px)', color: TEXT2, maxWidth: 520, lineHeight: 1.7, margin: '0 0 40px' }}>
          PeakLedger brings together a live personal finance dashboard and hands-on education tools for students, instructors, and anyone who wants to get serious about their money.
        </p>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button onClick={() => navigate('/register')}
            style={{ padding: '14px 32px', background: BLUE_BTN, color: '#fff', border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 24px rgba(0,102,245,0.35)' }}>
            Get Started Free
          </button>
          <a href={DOWNLOAD_URL} download
            style={{ padding: '14px 32px', background: CARD, color: TEXT, border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 16, fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>↓</span> Download for Windows
          </a>
        </div>
        <p style={{ marginTop: 16, fontSize: 12, color: TEXT3 }}>Free to use. No credit card required. Windows desktop app available.</p>
      </section>

      {/* Features */}
      <section style={{ padding: '80px 40px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 800, letterSpacing: '-1.5px', margin: '0 0 12px', color: TEXT }}>Everything in one place</h2>
          <p style={{ fontSize: 17, color: TEXT2, margin: 0 }}>Tools that work together so you can focus on learning, not switching apps.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
          {FEATURES.map(f => (
            <div key={f.title} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '28px 28px', transition: 'box-shadow 0.2s' }}>
              <div style={{ width: 44, height: 44, borderRadius: 11, background: `${f.color}15`, border: `1px solid ${f.color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: f.color, marginBottom: 18 }}>
                {f.icon}
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, letterSpacing: '-0.3px', color: TEXT }}>{f.title}</div>
              <div style={{ fontSize: 14, color: TEXT2, lineHeight: 1.6 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section style={{ padding: '80px 40px', borderTop: `1px solid ${BORDER}`, background: CARD }}>
        <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 800, letterSpacing: '-1.5px', margin: '0 0 12px', color: TEXT }}>Up and running in minutes</h2>
          <p style={{ fontSize: 17, color: TEXT2, marginBottom: 56 }}>Use PeakLedger in your browser or download the desktop app. Your account works the same either way.</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {STEPS.map((s, i) => (
              <div key={s.n} style={{ display: 'flex', gap: 28, alignItems: 'flex-start', textAlign: 'left', paddingBottom: i < STEPS.length - 1 ? 36 : 0, marginBottom: i < STEPS.length - 1 ? 36 : 0, borderBottom: i < STEPS.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: BLUE_BTN, letterSpacing: '1px', minWidth: 28, paddingTop: 2 }}>{s.n}</div>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 6, color: TEXT }}>{s.title}</div>
                  <div style={{ fontSize: 14, color: TEXT2, lineHeight: 1.6 }}>{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Download CTA */}
      <section style={{ padding: '80px 40px', borderTop: `1px solid ${BORDER}` }}>
        <div style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center', background: '#0f172a', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 20, padding: '56px 48px', boxShadow: '0 0 60px rgba(37,99,235,0.08)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#60a5fa', letterSpacing: '1px', marginBottom: 16 }}>DESKTOP APP</div>
          <h2 style={{ fontSize: 'clamp(24px, 3.5vw, 36px)', fontWeight: 800, letterSpacing: '-1px', margin: '0 0 14px', color: '#f1f5f9' }}>Get the desktop app</h2>
          <p style={{ fontSize: 16, color: '#94a3b8', lineHeight: 1.65, marginBottom: 36 }}>
            The Windows desktop app gives you a dedicated window for PeakLedger. Your account stays in sync across the app and the web.
          </p>
          <a href={DOWNLOAD_URL} download
            style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '14px 32px', background: BLUE_BTN, color: '#fff', borderRadius: 10, fontSize: 16, fontWeight: 700, textDecoration: 'none', boxShadow: '0 4px 24px rgba(0,102,245,0.35)' }}>
            <span style={{ fontSize: 20 }}>↓</span> Download for Windows
          </a>
          <p style={{ marginTop: 16, fontSize: 12, color: '#475569' }}>
            Windows 10 and 11. If Windows shows a security prompt, click "More info" then "Run anyway".
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: `1px solid ${BORDER}`, padding: '32px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, background: BG }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src="/logo-icon.svg" alt="" style={{ width: 24, height: 24, borderRadius: 6 }} />
          <span style={{ fontSize: 15, fontWeight: 700, color: TEXT, letterSpacing: '-0.3px' }}>PeakLedger</span>
        </div>
        <div style={{ fontSize: 13, color: TEXT3 }}>Personal finance, built for real life.</div>
        <div style={{ display: 'flex', gap: 20 }}>
          <button onClick={() => navigate('/login')}   style={{ background: 'none', border: 'none', color: TEXT2, fontSize: 13, cursor: 'pointer' }}>Sign In</button>
          <button onClick={() => navigate('/register')} style={{ background: 'none', border: 'none', color: TEXT2, fontSize: 13, cursor: 'pointer' }}>Register</button>
        </div>
      </footer>

    </div>
  );
}
