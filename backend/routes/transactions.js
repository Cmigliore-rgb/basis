const express = require('express');
const router = express.Router();
const { plaidClient } = require('./plaid');

const getTokens = (req) => req.app.locals.accessTokens || [];

// LAST 30 DAYS OF TRANSACTIONS
router.get('/', async (req, res) => {
  const tokens = getTokens(req);
  if (!tokens.length) return res.json({ transactions: [] });
  try {
    const end = new Date().toISOString().split('T')[0];
    const start = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const all = await Promise.all(
      tokens.map(({ access_token }) =>
        plaidClient.transactionsGet({ access_token, start_date: start, end_date: end })
          .then(r => r.data.transactions)
          .catch(() => [])
      )
    );
    const transactions = all.flat().sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json({ transactions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// MONTH-TO-DATE BUDGET BY CATEGORY
router.get('/budget', async (req, res) => {
  const tokens = getTokens(req);
  if (!tokens.length) return res.json({ budget: [] });
  try {
    const end = new Date().toISOString().split('T')[0];
    const start = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const all = await Promise.all(
      tokens.map(({ access_token }) =>
        plaidClient.transactionsGet({ access_token, start_date: start, end_date: end })
          .then(r => r.data.transactions)
          .catch(() => [])
      )
    );
    const txns = all.flat().filter(t => t.amount > 0);
    const byCategory = {};
    txns.forEach(t => {
      const cat = t.personal_finance_category?.primary || t.category?.[0] || 'Other';
      byCategory[cat] = (byCategory[cat] || 0) + t.amount;
    });
    const budget = Object.entries(byCategory)
      .map(([category, total]) => ({ category, total: Math.round(total * 100) / 100 }))
      .sort((a, b) => b.total - a.total);
    res.json({ budget });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
