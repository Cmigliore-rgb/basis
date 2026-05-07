import React from 'react';
import { Link } from 'react-router-dom';

const S = {
  page: { minHeight: '100vh', background: '#0f0f0f', color: '#f1f5f9', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  wrap: { maxWidth: 720, margin: '0 auto', padding: '60px 24px 80px' },
  back: { display: 'inline-block', marginBottom: 32, fontSize: 13, color: '#94a3b8', textDecoration: 'none' },
  h1:   { fontSize: 28, fontWeight: 700, marginBottom: 8, color: '#f1f5f9' },
  date: { fontSize: 13, color: '#64748b', marginBottom: 48 },
  h2:   { fontSize: 17, fontWeight: 700, marginTop: 40, marginBottom: 12, color: '#e2e8f0' },
  p:    { fontSize: 14, lineHeight: 1.75, color: '#94a3b8', marginBottom: 16 },
  ul:   { paddingLeft: 20, marginBottom: 16 },
  li:   { fontSize: 14, lineHeight: 1.75, color: '#94a3b8', marginBottom: 4 },
  a:    { color: '#4da3ff', textDecoration: 'none' },
};

export default function Privacy() {
  return (
    <div style={S.page}>
      <div style={S.wrap}>
        <Link to="/" style={S.back}>← Back</Link>

        <h1 style={S.h1}>Privacy Policy</h1>
        <p style={S.date}>Last updated: May 7, 2026</p>

        <p style={S.p}>
          PeakLedger ("we," "our," or "us") is committed to protecting your privacy. This Privacy
          Policy explains how we collect, use, store, and protect your information when you use our
          personal finance platform at peakledger.app ("Service").
        </p>

        <h2 style={S.h2}>1. Information We Collect</h2>
        <p style={S.p}><strong style={{ color: '#e2e8f0' }}>Account information</strong> — when you register, we collect your name, email address, and a
          bcrypt-hashed version of your password. We never store your plaintext password.</p>
        <p style={S.p}><strong style={{ color: '#e2e8f0' }}>Financial data via Plaid</strong> — if you choose to connect a bank or investment account, we
          access the following through Plaid Technologies, Inc.:</p>
        <ul style={S.ul}>
          <li style={S.li}>Account balances and account names</li>
          <li style={S.li}>Transaction history (up to 90 days)</li>
          <li style={S.li}>Investment holdings and portfolio values</li>
          <li style={S.li}>Liability details (credit cards, student loans, mortgages)</li>
        </ul>
        <p style={S.p}><strong style={{ color: '#e2e8f0' }}>Manually entered data</strong> — liabilities, baselines, and other data you enter directly
          into the Service.</p>
        <p style={S.p}><strong style={{ color: '#e2e8f0' }}>Usage data</strong> — we may log standard server-side request logs (IP address, browser
          type, pages visited) for security and debugging purposes.</p>

        <h2 style={S.h2}>2. How We Use Your Information</h2>
        <ul style={S.ul}>
          <li style={S.li}>To display your financial dashboard, net worth, and spending insights</li>
          <li style={S.li}>To calculate and track changes to your financial position over time</li>
          <li style={S.li}>To send account-related emails (email verification, support)</li>
          <li style={S.li}>To improve the Service and diagnose technical issues</li>
        </ul>
        <p style={S.p}>We do not sell your personal or financial data to any third party. We do not use
          your financial data to train machine learning models or for advertising.</p>

        <h2 style={S.h2}>3. How We Store and Protect Your Data</h2>
        <p style={S.p}>Your data is stored in a secured server-side database. Plaid access tokens — which
          authorize us to retrieve your bank data — are stored exclusively on our servers and are never
          transmitted to your browser or any third party other than Plaid.</p>
        <p style={S.p}>We use industry-standard security practices including HTTPS, hashed passwords, and
          bearer-token authentication. However, no method of transmission or storage is 100% secure,
          and we cannot guarantee absolute security.</p>

        <h2 style={S.h2}>4. Plaid</h2>
        <p style={S.p}>We use <a href="https://plaid.com" style={S.a} target="_blank" rel="noreferrer">Plaid</a> to
          connect your bank accounts. When you link an account, you interact directly with Plaid's
          interface and agree to{' '}
          <a href="https://plaid.com/legal/#end-user-privacy-policy" style={S.a} target="_blank" rel="noreferrer">
            Plaid's Privacy Policy
          </a>. Plaid may collect and process your data according to their own policies. We encourage
          you to review them.</p>

        <h2 style={S.h2}>5. Data Retention and Deletion</h2>
        <p style={S.p}>We retain your data for as long as your account is active. You may permanently delete
          your account and all associated data at any time from Settings → Account → Delete Account.
          This action removes all financial data, Plaid connections, and account information from our
          servers and is irreversible.</p>

        <h2 style={S.h2}>6. Cookies and Local Storage</h2>
        <p style={S.p}>We use your browser's local storage to persist your authentication token across
          sessions. We do not use third-party tracking cookies or advertising cookies.</p>

        <h2 style={S.h2}>7. Children's Privacy</h2>
        <p style={S.p}>The Service is not directed to individuals under the age of 18. We do not knowingly
          collect personal information from minors. If you believe a minor has provided us with
          information, please contact us so we can delete it.</p>

        <h2 style={S.h2}>8. Changes to This Policy</h2>
        <p style={S.p}>We may update this Privacy Policy from time to time. We will notify you of material
          changes by updating the "Last updated" date at the top of this page. Continued use of the
          Service after changes constitutes acceptance of the updated policy.</p>

        <h2 style={S.h2}>9. Contact</h2>
        <p style={S.p}>If you have questions about this Privacy Policy or your data, contact us at{' '}
          <a href="mailto:support@peakledger.app" style={S.a}>support@peakledger.app</a>.</p>
      </div>
    </div>
  );
}
