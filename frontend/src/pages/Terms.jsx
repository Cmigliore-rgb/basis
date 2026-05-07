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

export default function Terms() {
  return (
    <div style={S.page}>
      <div style={S.wrap}>
        <Link to="/" style={S.back}>← Back</Link>

        <h1 style={S.h1}>Terms of Service</h1>
        <p style={S.date}>Last updated: May 7, 2026</p>

        <p style={S.p}>
          Please read these Terms of Service ("Terms") carefully before using PeakLedger ("Service"),
          operated by PeakLedger ("we," "our," or "us"). By creating an account or using the Service,
          you agree to be bound by these Terms.
        </p>

        <h2 style={S.h2}>1. Eligibility</h2>
        <p style={S.p}>You must be at least 18 years old to use the Service. By using the Service, you
          represent that you meet this requirement and that all information you provide is accurate
          and complete.</p>

        <h2 style={S.h2}>2. Your Account</h2>
        <p style={S.p}>You are responsible for maintaining the confidentiality of your account credentials
          and for all activity that occurs under your account. Notify us immediately at{' '}
          <a href="mailto:support@peakledger.app" style={S.a}>support@peakledger.app</a> if you
          suspect unauthorized access.</p>
        <p style={S.p}>You may not share your account with others, use the Service for any illegal purpose,
          or attempt to access another user's data.</p>

        <h2 style={S.h2}>3. Financial Data and Third-Party Services</h2>
        <p style={S.p}>The Service allows you to connect financial accounts through Plaid Technologies, Inc.
          By connecting an account, you authorize us to retrieve your financial data (balances,
          transactions, holdings, and liabilities) through Plaid on your behalf.</p>
        <p style={S.p}>Your use of Plaid is also governed by{' '}
          <a href="https://plaid.com/legal/" style={S.a} target="_blank" rel="noreferrer">
            Plaid's Terms of Service and End User Privacy Policy
          </a>.</p>

        <h2 style={S.h2}>4. Not Financial Advice</h2>
        <p style={S.p}>The Service is a personal finance tracking and educational tool. Nothing on PeakLedger
          constitutes financial, investment, tax, or legal advice. We are not a registered investment
          advisor, broker-dealer, or financial institution. Always consult a qualified professional
          before making financial decisions.</p>

        <h2 style={S.h2}>5. Acceptable Use</h2>
        <p style={S.p}>You agree not to:</p>
        <ul style={S.ul}>
          <li style={S.li}>Use the Service in any way that violates applicable laws or regulations</li>
          <li style={S.li}>Attempt to reverse engineer, scrape, or disrupt the Service</li>
          <li style={S.li}>Provide false or misleading information when registering</li>
          <li style={S.li}>Use the Service to transmit malware or harmful code</li>
        </ul>

        <h2 style={S.h2}>6. Data Accuracy</h2>
        <p style={S.p}>We display financial data as retrieved from your connected institutions via Plaid.
          We are not responsible for inaccuracies, delays, or errors in data provided by your
          financial institutions or Plaid. Always verify important financial information with your
          institution directly.</p>

        <h2 style={S.h2}>7. Service Availability</h2>
        <p style={S.p}>We strive to keep the Service available, but we do not guarantee uninterrupted or
          error-free operation. We may modify, suspend, or discontinue the Service at any time with
          reasonable notice where practicable.</p>

        <h2 style={S.h2}>8. Termination</h2>
        <p style={S.p}>You may terminate your account at any time from Settings → Account → Delete Account.
          We may suspend or terminate your access if you violate these Terms, with or without notice.</p>
        <p style={S.p}>Upon termination, all your data is permanently deleted from our servers.</p>

        <h2 style={S.h2}>9. Disclaimer of Warranties</h2>
        <p style={S.p}>THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND,
          EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR
          A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE
          UNINTERRUPTED, SECURE, OR FREE OF ERRORS.</p>

        <h2 style={S.h2}>10. Limitation of Liability</h2>
        <p style={S.p}>TO THE MAXIMUM EXTENT PERMITTED BY LAW, PEAKLEDGER SHALL NOT BE LIABLE FOR ANY
          INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF
          OR INABILITY TO USE THE SERVICE, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH
          DAMAGES. OUR TOTAL LIABILITY SHALL NOT EXCEED $100 OR THE AMOUNT YOU PAID US IN THE PAST
          12 MONTHS, WHICHEVER IS GREATER.</p>

        <h2 style={S.h2}>11. Changes to These Terms</h2>
        <p style={S.p}>We may update these Terms from time to time. We will notify you of material changes
          by updating the "Last updated" date. Continued use of the Service after changes take effect
          constitutes your acceptance of the revised Terms.</p>

        <h2 style={S.h2}>12. Governing Law</h2>
        <p style={S.p}>These Terms are governed by the laws of the State of Georgia, without regard to its
          conflict of law provisions. Any disputes shall be resolved in the courts located in Georgia.</p>

        <h2 style={S.h2}>13. Contact</h2>
        <p style={S.p}>Questions about these Terms? Contact us at{' '}
          <a href="mailto:support@peakledger.app" style={S.a}>support@peakledger.app</a>.</p>
      </div>
    </div>
  );
}
