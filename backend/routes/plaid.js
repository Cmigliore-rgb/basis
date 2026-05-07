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
      client_name: 'PeakLedger',
      products: [Products.Transactions],
      optional_products: [Products.Investments],
      country_codes: [CountryCode.Us],
      language: 'en',
      webhook: 'https://peakledger.app/api/plaid/webhook',
    };
    if (process.env.PLAID_REDIRECT_URI) {
      params.redirect_uri = process.env.PLAID_REDIRECT_URI;
    }
    const response = await plaidClient.linkTokenCreate(params);
    res.json({ link_token: response.data.link_token });
  } catch (err) {
    const detail = err.response?.data || err.message;
    console.error('create_link_token error:', JSON.stringify(detail));
    res.status(500).json({ error: typeof detail === 'object' ? JSON.stringify(detail) : detail });
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

router.post('/webhook', express.json(), (req, res) => {
  const { webhook_type, webhook_code, item_id } = req.body;
  console.log(`Plaid webhook: ${webhook_type}/${webhook_code} item=${item_id}`);

  if (webhook_type === 'TRANSACTIONS' && ['DEFAULT_UPDATE', 'INITIAL_UPDATE', 'HISTORICAL_UPDATE'].includes(webhook_code)) {
    // New transactions available — logged for now, real-time push can be added later
  }

  if (webhook_type === 'ITEM' && webhook_code === 'ERROR') {
    console.warn(`Plaid item error for item ${item_id}:`, req.body.error);
  }

  res.json({ received: true });
});

module.exports = router;
module.exports.plaidClient = plaidClient;
