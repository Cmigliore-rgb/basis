import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const BG       = '#0f0f0f';
const CARD     = '#1c1c1e';
const BORDER   = '#2a2a2a';
const TEXT     = '#f0f0f0';
const TEXT2    = '#8e8e93';
const TEXT3    = '#444';
const BLUE     = '#4da3ff';
const BLUE_BTN = '#0066f5';
const GREEN    = '#4ade80';
const PURPLE   = '#a78bfa';
const YELLOW   = '#fbbf24';

const DOWNLOAD_URL = 'https://github.com/Cmigliore-rgb/basis/releases/download/untagged-a510778e091885ecca62/Basis.Setup.1.0.0.exe';

const FEATURES = [
  {
    icon: '◎', color: BLUE,
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
  { n: '01', title: 'Create your account', desc: 'Sign up free in under a minute. No credit card required.' },
  { n: '02', title: 'Connect your finances', desc: 'Link bank accounts and investment portfolios securely via Plaid.' },
  { n: '03', title: 'Learn and track', desc: 'Work through assignments, explore your data, and build real financial literacy.' },
];

export default function Landing() {
  const { user } = useAuth();
  const navigate = useNavigate();
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
        background: scrolled ? 'rgba(15,15,15,0.92)' : 'transparent',
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
        borderBottom: scrolled ? `1px solid ${BORDER}` : 'none',
        transition: 'all 0.2s',
      }}>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-1px', color: TEXT }}>Basis</div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
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
        <div style={{ position: 'absolute', top: '30%', left: '50%', transform: 'translate(-50%, -50%)', width: 600, height: 600, background: `radial-gradient(circle, ${BLUE}0f 0%, transparent 70%)`, pointerEvents: 'none' }} />

        <h1 style={{ fontSize: 'clamp(40px, 7vw, 80px)', fontWeight: 800, letterSpacing: '-3px', lineHeight: 1.05, margin: '0 0 24px', maxWidth: 800 }}>
          Your finances,<br />
          <span style={{ color: BLUE }}>finally in focus.</span>
        </h1>

        <p style={{ fontSize: 'clamp(16px, 2vw, 20px)', color: TEXT2, maxWidth: 520, lineHeight: 1.65, margin: '0 0 40px' }}>
          Basis brings together a live personal finance dashboard and hands-on education tools for students, instructors, and anyone who wants to get serious about their money.
        </p>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button onClick={() => navigate('/register')}
            style={{ padding: '14px 32px', background: BLUE_BTN, color: '#fff', border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
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
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 800, letterSpacing: '-1.5px', margin: '0 0 12px' }}>Everything in one place</h2>
          <p style={{ fontSize: 17, color: TEXT2, margin: 0 }}>Tools that work together so you can focus on learning, not switching apps.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
          {FEATURES.map(f => (
            <div key={f.title} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '28px 28px' }}>
              <div style={{ width: 44, height: 44, borderRadius: 11, background: `${f.color}18`, border: `1px solid ${f.color}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: f.color, marginBottom: 18 }}>
                {f.icon}
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, letterSpacing: '-0.3px' }}>{f.title}</div>
              <div style={{ fontSize: 14, color: TEXT2, lineHeight: 1.6 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section style={{ padding: '80px 40px', borderTop: `1px solid ${BORDER}` }}>
        <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 800, letterSpacing: '-1.5px', margin: '0 0 12px' }}>Up and running in minutes</h2>
          <p style={{ fontSize: 17, color: TEXT2, marginBottom: 56 }}>Use Basis in your browser or download the desktop app. Your data stays in sync either way.</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {STEPS.map((s, i) => (
              <div key={s.n} style={{ display: 'flex', gap: 28, alignItems: 'flex-start', textAlign: 'left', paddingBottom: i < STEPS.length - 1 ? 36 : 0, marginBottom: i < STEPS.length - 1 ? 36 : 0, borderBottom: i < STEPS.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: BLUE, letterSpacing: '1px', minWidth: 28, paddingTop: 2 }}>{s.n}</div>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>{s.title}</div>
                  <div style={{ fontSize: 14, color: TEXT2, lineHeight: 1.6 }}>{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Download CTA */}
      <section style={{ padding: '80px 40px', borderTop: `1px solid ${BORDER}` }}>
        <div style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center', background: CARD, border: `1px solid ${BORDER}`, borderRadius: 20, padding: '56px 48px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: BLUE, letterSpacing: '1px', marginBottom: 16 }}>DESKTOP APP</div>
          <h2 style={{ fontSize: 'clamp(24px, 3.5vw, 36px)', fontWeight: 800, letterSpacing: '-1px', margin: '0 0 14px' }}>Take Basis offline</h2>
          <p style={{ fontSize: 16, color: TEXT2, lineHeight: 1.65, marginBottom: 36 }}>
            The Windows desktop app runs everything locally with no browser needed. Your data, your machine.
          </p>
          <a href={DOWNLOAD_URL} download
            style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '14px 32px', background: BLUE_BTN, color: '#fff', borderRadius: 10, fontSize: 16, fontWeight: 700, textDecoration: 'none' }}>
            <span style={{ fontSize: 20 }}>↓</span> Download for Windows
          </a>
          <p style={{ marginTop: 16, fontSize: 12, color: TEXT3 }}>
            Windows 10 and 11. If Windows shows a security prompt, click "More info" then "Run anyway".
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: `1px solid ${BORDER}`, padding: '32px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.5px', color: TEXT }}>Basis</div>
        <div style={{ fontSize: 13, color: TEXT3 }}>Personal finance, built for real life.</div>
        <div style={{ display: 'flex', gap: 20 }}>
          <button onClick={() => navigate('/login')} style={{ background: 'none', border: 'none', color: TEXT2, fontSize: 13, cursor: 'pointer' }}>Sign In</button>
          <button onClick={() => navigate('/register')} style={{ background: 'none', border: 'none', color: TEXT2, fontSize: 13, cursor: 'pointer' }}>Register</button>
        </div>
      </footer>

    </div>
  );
}
