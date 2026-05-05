const express = require('express');
const router = express.Router();
const { PlaidApi, PlaidEnvironments, Configuration, Products, CountryCode } = require('plaid');
const store = require('../store');
const requireAuth = require('../middleware/requireAuth');

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

// CREATE LINK TOKEN
router.post('/create_link_token', async (req, res) => {
  try {
    const params = {
      user: { client_user_id: 'ledger-user' },
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

// EXCHANGE PUBLIC TOKEN
router.post('/exchange_token', async (req, res) => {
  const { public_token, institution_name } = req.body;
  try {
    const response = await plaidClient.itemPublicTokenExchange({ public_token });
    const access_token = response.data.access_token;
    if (!req.app.locals.accessTokens) req.app.locals.accessTokens = [];
    req.app.locals.accessTokens.push({ access_token, institution_name });
    store.save(req.app);
    res.json({ success: true });
  } catch (err) {
    console.error('exchange_token error:', err.message);
    res.status(500).json({ error: 'Token exchange failed' });
  }
});

// FETCH ALL ACCOUNTS
router.get('/accounts', requireAuth, async (req, res) => {
  try {
    const { getAccounts } = require('../data_controller');
    res.json(await getAccounts(req));
  } catch (err) {
    console.error('accounts error:', err.response?.data || err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
module.exports.plaidClient = plaidClient;
