const express = require('express');
const router = express.Router();
const axios = require('axios');

const mxClient = axios.create({
  baseURL: process.env.MX_ENV === 'production' ? 'https://api.mx.com' : 'https://int-api.mx.com',
  auth: {
    username: process.env.MX_CLIENT_ID,
    password: process.env.MX_API_KEY,
  },
  headers: {
    Accept: 'application/vnd.mx.api.v1+json',
    'Content-Type': 'application/json',
  },
});

const getOrCreateUser = async (app) => {
  if (app.locals.mxUserGuid) return app.locals.mxUserGuid;
  try {
    const r = await mxClient.post('/users', { user: { id: 'ledger-user' } });
    app.locals.mxUserGuid = r.data.user.guid;
    return app.locals.mxUserGuid;
  } catch (err) {
    if (err.response?.status === 409) {
      const list = await mxClient.get('/users', { params: { page: 1, records_per_page: 100 } });
      const user = (list.data.users || []).find(u => u.id === 'ledger-user');
      if (user) {
        app.locals.mxUserGuid = user.guid;
        return app.locals.mxUserGuid;
      }
    }
    throw err;
  }
};

// GET CONNECT WIDGET URL
router.post('/connect_url', async (req, res) => {
  try {
    const userGuid = await getOrCreateUser(req.app);
    const r = await mxClient.post(`/users/${userGuid}/connect_widget_url`, {
      widget_url: {
        widget_type: 'connect_widget',
        is_mobile_webview: false,
        include_transactions: true,
      },
    });
    res.json({ url: r.data.widget_url.url });
  } catch (err) {
    console.error('MX connect_url error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to get MX connect URL' });
  }
});

// GET MX ACCOUNTS
router.get('/accounts', async (req, res) => {
  try {
    const userGuid = req.app.locals.mxUserGuid;
    if (!userGuid) return res.json({ accounts: [] });
    const r = await mxClient.get(`/users/${userGuid}/accounts`);
    const accounts = (r.data.accounts || []).map(a => ({
      account_id: a.guid,
      name: a.name,
      institution_name: 'Capital One',
      subtype: a.account_type,
      balances: { current: a.balance },
    }));
    res.json({ accounts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
