const express = require('express');
const router = express.Router();
const { PlaidApi, PlaidEnvironments, Configuration, Products, CountryCode } = require('plaid');
const requireAuth = require('../middleware/requireAuth');
const db = require('../db');

const config = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV || 'production'],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});

const plaidClient = new PlaidApi(config);

router.post('/create_link_token', requireAuth, async (req, res) => {
  try {
    const params = {
      user: { client_user_id: String(req.user.id) },
      client_name: 'Basis',
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en',
    };
    if (process.env.PLAID_REDIRECT_URI) {
      params.redirect_uri = process.env.PLAID_REDIRECT_URI;
    }
    const response = await plaidClient.linkTokenCreate(params);
    res.json({ link_token: response.data.link_token });
  } catch (err) {
    console.error('create_link_token error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to create link token' });
  }
});

router.post('/exchange_token', requireAuth, async (req, res) => {
  const { public_token, institution_name } = req.body;
  try {
    const response = await plaidClient.itemPublicTokenExchange({ public_token });
    const access_token = response.data.access_token;
    db.prepare(`
      INSERT INTO plaid_tokens (user_id, access_token, institution_name)
      VALUES (?, ?, ?)
    `).run(req.user.id, access_token, institution_name || 'Unknown');
    res.json({ success: true });
  } catch (err) {
    console.error('exchange_token error:', err.message);
    res.status(500).json({ error: 'Token exchange failed' });
  }
});

router.get('/accounts', requireAuth, async (req, res) => {
  try {
    const { getAccounts } = require('../data_controller');
    res.json(await getAccounts(req));
  } catch (err) {
    console.error('accounts error:', err.response?.data || err.message);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/disconnect/:id', requireAuth, async (req, res) => {
  db.prepare('DELETE FROM plaid_tokens WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ success: true });
});

router.get('/connections', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT id, institution_name, created_at FROM plaid_tokens WHERE user_id = ?').all(req.user.id);
  res.json(rows);
});

module.exports = router;
module.exports.plaidClient = plaidClient;
