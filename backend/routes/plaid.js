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
      optional_products: [Products.Investments, Products.Liabilities],
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

// ── Update mode: create a link token tied to an existing access token ────────
router.post('/create_update_token', requireAuth, async (req, res) => {
  const { token_id } = req.body;
  const row = db.prepare('SELECT access_token FROM plaid_tokens WHERE id = ? AND user_id = ?').get(token_id, req.user.id);
  if (!row) return res.status(404).json({ error: 'Connection not found' });
  try {
    const params = {
      user: { client_user_id: String(req.user.id) },
      client_name: 'PeakLedger',
      access_token: row.access_token,
      language: 'en',
      country_codes: [CountryCode.Us],
      webhook: 'https://peakledger.app/api/plaid/webhook',
    };
    if (process.env.PLAID_REDIRECT_URI) params.redirect_uri = process.env.PLAID_REDIRECT_URI;
    const response = await plaidClient.linkTokenCreate(params);
    res.json({ link_token: response.data.link_token });
  } catch (err) {
    const detail = err.response?.data || err.message;
    console.error('create_update_token error:', JSON.stringify(detail));
    res.status(500).json({ error: typeof detail === 'object' ? JSON.stringify(detail) : detail });
  }
});

router.post('/exchange_token', requireAuth, async (req, res) => {
  const { public_token, institution_name } = req.body;
  try {
    const response = await plaidClient.itemPublicTokenExchange({ public_token });
    const { access_token, item_id } = response.data;
    db.prepare(`
      INSERT INTO plaid_tokens (user_id, access_token, institution_name, item_id)
      VALUES (?, ?, ?, ?)
    `).run(req.user.id, access_token, institution_name || 'Unknown', item_id);
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

router.get('/liabilities', requireAuth, async (req, res) => {
  try {
    const { getLiabilities } = require('../data_controller');
    res.json(await getLiabilities(req));
  } catch (err) {
    console.error('liabilities error:', err.response?.data || err.message);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/disconnect/:id', requireAuth, async (req, res) => {
  db.prepare('DELETE FROM plaid_tokens WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ success: true });
});

router.get('/connections', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT id, institution_name, created_at, needs_update FROM plaid_tokens WHERE user_id = ?').all(req.user.id);
  res.json(rows);
});

// ── Dismiss update prompt without re-authenticating ──────────────────────────
router.post('/dismiss_update/:id', requireAuth, (req, res) => {
  db.prepare('UPDATE plaid_tokens SET needs_update = 0 WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ success: true });
});

// ── Manual liabilities (only when at least one bank is connected) ──────────

function hasConnectedBank(userId) {
  return db.prepare('SELECT 1 FROM plaid_tokens WHERE user_id = ? LIMIT 1').get(userId) != null;
}

router.get('/manual-liabilities', requireAuth, (req, res) => {
  if (!hasConnectedBank(req.user.id)) return res.json({ rows: [] });
  const rows = db.prepare('SELECT * FROM manual_liabilities WHERE user_id = ? ORDER BY created_at ASC').all(req.user.id);
  res.json({ rows });
});

router.post('/manual-liabilities', requireAuth, (req, res) => {
  if (!hasConnectedBank(req.user.id)) return res.status(403).json({ error: 'Connect a bank account first' });
  const { type, name, balance, interest_rate, minimum_payment, credit_limit, due_day } = req.body;
  if (!type || !name || balance == null) return res.status(400).json({ error: 'type, name, and balance are required' });
  if (!['credit','student','mortgage'].includes(type)) return res.status(400).json({ error: 'Invalid type' });
  const result = db.prepare(`
    INSERT INTO manual_liabilities (user_id, type, name, balance, interest_rate, minimum_payment, credit_limit, due_day)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.user.id, type, name, Number(balance), interest_rate ?? null, minimum_payment ?? null, credit_limit ?? null, due_day ?? null);
  res.json({ id: result.lastInsertRowid });
});

router.patch('/manual-liabilities/:id', requireAuth, (req, res) => {
  const { name, balance, interest_rate, minimum_payment, credit_limit, due_day } = req.body;
  const row = db.prepare('SELECT * FROM manual_liabilities WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  db.prepare(`
    UPDATE manual_liabilities
    SET name = ?, balance = ?, interest_rate = ?, minimum_payment = ?, credit_limit = ?, due_day = ?, updated_at = datetime('now')
    WHERE id = ? AND user_id = ?
  `).run(
    name ?? row.name,
    balance != null ? Number(balance) : row.balance,
    interest_rate !== undefined ? interest_rate : row.interest_rate,
    minimum_payment !== undefined ? minimum_payment : row.minimum_payment,
    credit_limit !== undefined ? credit_limit : row.credit_limit,
    due_day !== undefined ? due_day : row.due_day,
    row.id, req.user.id
  );
  res.json({ success: true });
});

router.delete('/manual-liabilities/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM manual_liabilities WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ success: true });
});

router.post('/webhook', express.json(), (req, res) => {
  const { webhook_type, webhook_code, item_id } = req.body;
  console.log(`Plaid webhook: ${webhook_type}/${webhook_code} item=${item_id}`);

  if (webhook_type === 'TRANSACTIONS' && ['DEFAULT_UPDATE', 'INITIAL_UPDATE', 'HISTORICAL_UPDATE'].includes(webhook_code)) {
    // New transactions available — real-time push can be added later
  }

  if (webhook_type === 'ITEM') {
    // Flag items that need re-authentication
    if (['ITEM_LOGIN_REQUIRED', 'PENDING_EXPIRATION', 'PENDING_DISCONNECT'].includes(webhook_code)) {
      db.prepare('UPDATE plaid_tokens SET needs_update = 1 WHERE item_id = ?').run(item_id);
      console.log(`Item needs re-auth: ${item_id} (${webhook_code})`);
    }
    if (webhook_code === 'ERROR') {
      console.warn(`Plaid item error for item ${item_id}:`, req.body.error);
      if (req.body.error?.error_code === 'ITEM_LOGIN_REQUIRED') {
        db.prepare('UPDATE plaid_tokens SET needs_update = 1 WHERE item_id = ?').run(item_id);
      }
    }
  }

  res.json({ received: true });
});

module.exports = router;
module.exports.plaidClient = plaidClient;
