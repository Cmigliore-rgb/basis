const express = require('express');
const router = express.Router();
const axios = require('axios');
const store = require('../store');
const https = require('https');
const fs = require('fs');
const path = require('path');

let tellerClient = null;
try {
  const agent = new https.Agent({
    cert: fs.readFileSync(path.join(__dirname, '../certificate.pem')),
    key: fs.readFileSync(path.join(__dirname, '../private_key.pem')),
  });
  tellerClient = axios.create({
    baseURL: 'https://api.teller.io',
    httpsAgent: agent,
  });
  console.log('Teller mTLS client ready');
} catch {
  console.warn('Teller certs not found — place certificate.pem and private_key.pem in backend/');
}

const requireClient = (req, res, next) => {
  if (!tellerClient) return res.status(503).json({ error: 'Teller certificates not configured' });
  next();
};

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const cache = { accounts: null, transactions: null, accountsAt: 0, transactionsAt: 0 };

// Force a cache bust on startup so fresh balances are always fetched after a restart
cache.accountsAt = 0;

router.post('/enroll', (req, res) => {
  const { access_token } = req.body;
  if (!access_token) return res.status(400).json({ error: 'access_token required' });
  // Replace all tokens with the new one — re-enrollment always supersedes old tokens
  req.app.locals.tellerTokens = [access_token];
  store.save(req.app);
  // Bust cache on new enrollment
  cache.accountsAt = 0;
  cache.transactionsAt = 0;
  res.json({ success: true });
});

router.get('/accounts', requireClient, async (req, res) => {
  const tokens = req.app.locals.tellerTokens || [];
  if (!tokens.length) return res.json({ accounts: [] });

  if (cache.accounts && Date.now() - cache.accountsAt < CACHE_TTL) {
    return res.json({ accounts: cache.accounts });
  }

  try {
    const all = await Promise.all(tokens.map(async (token) => {
      const auth = { username: token, password: '' };
      const { data: accs } = await tellerClient.get('/accounts', { auth });
      return Promise.all(accs.map(async (acc) => {
        let current = 0, available = 0;
        try {
          const { data: bal } = await tellerClient.get(`/accounts/${acc.id}/balances`, { auth });
          current   = parseFloat(bal.ledger    ?? bal.available ?? 0);
          available = parseFloat(bal.available ?? bal.ledger    ?? 0);
        } catch (e) {
          const code = e.response?.data?.error?.code;
          if (code === 'account.closed') {
            console.warn(`Teller reports "${acc.name}" as closed — token may be stale, re-enroll via Teller Connect`);
          }
          console.warn(`Balance fetch failed for "${acc.name}":`, e.response?.data || e.message);
        }
        return {
          account_id: acc.id,
          name: acc.name,
          institution_name: acc.institution.name,
          subtype: acc.subtype,
          type: acc.type,
          balances: { current, available },
        };
      }));
    }));
    const seen = new Set();
    cache.accounts = all.flat().filter(a => {
      if (!a || seen.has(a.account_id)) return false;
      seen.add(a.account_id);
      return true;
    });
    cache.accountsAt = Date.now();
    res.json({ accounts: cache.accounts });
  } catch (err) {
    console.error('Teller accounts error:', err.response?.data || err.message);
    if (cache.accounts) return res.json({ accounts: cache.accounts });
    res.status(500).json({ error: err.message });
  }
});

router.get('/transactions', requireClient, async (req, res) => {
  const tokens = req.app.locals.tellerTokens || [];
  if (!tokens.length) return res.json({ transactions: [] });

  if (cache.transactions && Date.now() - cache.transactionsAt < CACHE_TTL) {
    return res.json({ transactions: cache.transactions });
  }

  try {
    const all = await Promise.all(tokens.map(async (token) => {
      const auth = { username: token, password: '' };
      const { data: accs } = await tellerClient.get('/accounts', { auth });
      const txnArrays = await Promise.all(
        accs.map(acc =>
          tellerClient.get(`/accounts/${acc.id}/transactions`, { auth })
            .then(({ data }) => {
              const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
              return data
                .filter(t => new Date(t.date) >= cutoff)
                .map(t => ({
                  transaction_id: t.id,
                  account_id: t.account_id,
                  date: t.date,
                  name: t.description,
                  merchant_name: t.details?.counterparty?.name || t.description,
                  // Credit cards: Teller positive = purchase (matches Plaid). No flip.
                  // Depository: Teller negative = purchase. Flip to match Plaid.
                  amount: acc.type === 'credit' ? parseFloat(t.amount) : parseFloat(t.amount) * -1,
                  category: [t.details?.category || 'Other'],
                  personal_finance_category: { primary: t.details?.category || 'Other' },
                }));
            })
            .catch(() => [])
        )
      );
      return txnArrays.flat();
    }));
    const seenTxn = new Set();
    const transactions = all.flat()
      .filter(t => {
        if (seenTxn.has(t.transaction_id)) return false;
        seenTxn.add(t.transaction_id);
        return true;
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    cache.transactions = transactions;
    cache.transactionsAt = Date.now();
    res.json({ transactions });
  } catch (err) {
    console.error('Teller transactions error:', err.response?.data || err.message);
    if (cache.transactions) return res.json({ transactions: cache.transactions });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
