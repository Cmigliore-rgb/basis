import React from 'react';
import { Link } from 'react-router-dom';

const BG    = '#0a0a0a';
const CARD  = '#141414';
const TEXT  = '#f1f5f9';
const TEXT2 = '#94a3b8';
const TEXT3 = '#4b5563';
const BLUE  = '#0066f5';
const GREEN = '#4ade80';
const BORDER = '1px solid rgba(255,255,255,0.08)';

const Check = ({ color = BLUE }) => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
    <circle cx="7" cy="7" r="7" fill={color} fillOpacity="0.15"/>
    <path d="M4 7l2 2 4-4" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export default function Pricing() {
  return (
    <div style={{ minHeight: '100vh', background: BG, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', color: TEXT }}>

      {/* Nav */}
      <div style={{ padding: '20px 32px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: BORDER }}>
        <img src="/logo-icon.svg?v=6" alt="" style={{ width: 30, height: 30, borderRadius: 7 }} />
        <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.5px' }}>PeakLedger</span>
        <Link to="/login" style={{ marginLeft: 'auto', fontSize: 13, color: TEXT2, textDecoration: 'none', fontWeight: 500 }}>Sign in</Link>
      </div>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '64px 24px' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: BLUE, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 14 }}>Pricing</div>
          <h1 style={{ fontSize: 42, fontWeight: 800, letterSpacing: '-1.5px', margin: 0, marginBottom: 16, lineHeight: 1.1 }}>Simple, transparent pricing</h1>
          <p style={{ fontSize: 16, color: TEXT2, margin: 0, lineHeight: 1.7, maxWidth: 480, marginInline: 'auto' }}>
            One plan. Billed monthly. Cancel from your account settings at any time with no fees.
          </p>
        </div>

        {/* Plan cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, marginBottom: 56 }}>

          {/* Free */}
          <div style={{ background: CARD, border: BORDER, borderRadius: 16, padding: '32px 28px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: TEXT3, marginBottom: 20 }}>Free</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 8 }}>
              <span style={{ fontSize: 42, fontWeight: 700, letterSpacing: '-1.5px' }}>$0</span>
              <span style={{ fontSize: 14, color: TEXT2 }}>/month</span>
            </div>
            <p style={{ fontSize: 13, color: TEXT2, marginBottom: 28, lineHeight: 1.6 }}>Everything you need to start learning personal finance and investing.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                'Education mode',
                'Learn library (17 topics)',
                'Sandbox financial data',
                'Options chain tool',
                'Tax estimator',
                'Market insights',
              ].map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <Check color={TEXT3} />
                  <span style={{ fontSize: 13, color: TEXT2 }}>{f}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Premium */}
          <div style={{ background: 'rgba(0,102,245,0.06)', border: '1px solid rgba(0,102,245,0.3)', borderRadius: 16, padding: '32px 28px', position: 'relative' }}>
            <div style={{ position: 'absolute', top: -12, left: 28, background: BLUE, color: '#fff', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', padding: '4px 10px', borderRadius: 20 }}>Most popular</div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: BLUE, marginBottom: 20 }}>Premium (Analyst)</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
              <span style={{ fontSize: 42, fontWeight: 700, letterSpacing: '-1.5px' }}>$9.99</span>
              <span style={{ fontSize: 14, color: TEXT2 }}>/month</span>
            </div>
            <div style={{ fontSize: 12, color: TEXT2, marginBottom: 4, fontStyle: 'italic' }}>Less than your monthly Netflix.</div>
            <div style={{ fontSize: 12, color: GREEN, marginBottom: 4, fontWeight: 600 }}>$5.99/mo with a verified .edu email</div>
            <div style={{ fontSize: 12, color: TEXT2, marginBottom: 8, fontStyle: 'italic' }}>Less than Spotify Premium.</div>
            <p style={{ fontSize: 13, color: TEXT2, marginBottom: 28, lineHeight: 1.6 }}>Connect your real accounts and get the full picture of your finances.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                'Everything in Free',
                'Real bank and brokerage account connection',
                'Net worth history and tracking',
                'Live budget analysis with category breakdowns',
                'Live portfolio P&L vs. S&P 500',
                'Sector allocation and holdings analysis',
                'AI financial assistant',
                'Video lessons and walkthroughs',
                'Practice quizzes and downloadable templates',
              ].map((f, i) => (
                <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <Check color={i === 0 ? TEXT3 : BLUE} />
                  <span style={{ fontSize: 13, color: i === 0 ? TEXT2 : TEXT, fontWeight: i === 0 ? 400 : 500 }}>{f}</span>
                </div>
              ))}
            </div>
            <a href="/login" style={{ display: 'block', marginTop: 28, padding: '13px 0', background: BLUE, color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer', textAlign: 'center', textDecoration: 'none' }}>
              Get started →
            </a>
          </div>
        </div>

        {/* How billing works */}
        <div style={{ background: CARD, border: BORDER, borderRadius: 16, padding: '36px 32px', marginBottom: 32 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 28, margin: 0, marginBottom: 24 }}>How billing works</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 28 }}>
            {[
              {
                icon: '📅',
                title: 'Monthly billing',
                body: 'You\'re charged once per month on the date you subscribed. There are no annual commitments or contracts.',
              },
              {
                icon: '🔒',
                title: 'Secured by Stripe',
                body: 'All payments are processed by Stripe. PeakLedger never stores your card details. Stripe is PCI-DSS Level 1 certified.',
              },
              {
                icon: '✕',
                title: 'Cancel anytime',
                body: 'Cancel from Settings at any time with one click. Your Premium access continues until the end of the current billing period, then reverts to Free automatically.',
              },
              {
                icon: '🎓',
                title: 'Student pricing',
                body: 'Verify your .edu email address in Settings to unlock $5.99/mo. The discount renews automatically as long as your .edu email stays verified.',
              },
            ].map(item => (
              <div key={item.title}>
                <div style={{ fontSize: 24, marginBottom: 10 }}>{item.icon}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: TEXT, marginBottom: 6 }}>{item.title}</div>
                <div style={{ fontSize: 13, color: TEXT2, lineHeight: 1.7 }}>{item.body}</div>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div style={{ marginBottom: 48 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 20 }}>Common questions</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[
              {
                q: 'What happens when I cancel?',
                a: 'Your Premium features stay active until the end of your paid billing period. After that, your account automatically downgrades to Free. No charges after cancellation.',
              },
              {
                q: 'Can I pause my subscription instead of canceling?',
                a: 'Pausing is not currently available. You can cancel and resubscribe at any time. Your account data is preserved.',
              },
              {
                q: 'Is my bank connection data stored securely?',
                a: 'Account connections are handled through Plaid, an industry-standard bank connectivity provider used by thousands of financial apps. PeakLedger only receives read-only access to transaction and balance data.',
              },
              {
                q: 'Do you offer refunds?',
                a: 'We don\'t offer refunds for partial billing periods, but you can cancel at any time to stop future charges. If you have an issue, contact us through the app.',
              },
              {
                q: 'How does the student discount work?',
                a: 'Add a .edu email address in Settings and verify it. Once verified, the discounted rate of $5.99/mo is applied at your next billing cycle. The discount applies as long as your .edu email remains verified (re-verification required annually).',
              },
            ].map((item, i, arr) => (
              <div key={item.q} style={{ padding: '20px 0', borderBottom: i < arr.length - 1 ? BORDER : 'none' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: TEXT, marginBottom: 8 }}>{item.q}</div>
                <div style={{ fontSize: 13, color: TEXT2, lineHeight: 1.7 }}>{item.a}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer links */}
        <div style={{ textAlign: 'center', fontSize: 12, color: TEXT3 }}>
          By subscribing you agree to our{' '}
          <Link to="/terms" style={{ color: TEXT2, textDecoration: 'underline' }}>Terms of Service</Link>
          {' '}and{' '}
          <Link to="/privacy" style={{ color: TEXT2, textDecoration: 'underline' }}>Privacy Policy</Link>.
        </div>
      </div>
    </div>
  );
}
