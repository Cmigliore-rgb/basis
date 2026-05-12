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
      account_filters: {
        depository: { account_subtypes: ['checking', 'savings'] },
        credit:     { account_subtypes: ['credit card'] },
        investment: { account_subtypes: ['brokerage', 'ira', 'roth', '401k'] },
        loan:       { account_subtypes: ['student', 'mortgage', 'auto'] },
      },
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
    // Rate limit: max 3 new connections per user per 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const recentCount = db.prepare(
      "SELECT COUNT(*) as cnt FROM plaid_tokens WHERE user_id = ? AND created_at > ?"
    ).get(req.user.id, oneDayAgo)?.cnt || 0;
    if (recentCount >= 3) {
      return res.status(429).json({ error: 'Too many accounts connected in the past 24 hours. Please try again later.' });
    }

    const response = await plaidClient.itemPublicTokenExchange({ public_token });
    const { access_token, item_id, request_id } = response.data;
    console.log(`[Plaid exchange_token] item_id=${item_id} request_id=${request_id}`);

    // Duplicate item detection — if this item_id is already linked, skip insert
    const existing = db.prepare('SELECT id FROM plaid_tokens WHERE item_id = ? AND user_id = ?').get(item_id, req.user.id);
    if (existing) return res.json({ success: true, duplicate: true });

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
  const row = db.prepare('SELECT access_token FROM plaid_tokens WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (row) {
    try { await plaidClient.itemRemove({ access_token: row.access_token }); } catch (e) {
      console.warn('itemRemove error (continuing):', e.message);
    }
  }
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

const jwkCache = new Map();

async function verifyPlaidWebhook(token, rawBody) {
  const [headerB64] = token.split('.');
  const { kid, alg } = JSON.parse(Buffer.from(headerB64, 'base64url').toString());

  let jwk = jwkCache.get(kid);
  if (!jwk) {
    const { data } = await plaidClient.webhookVerificationKeyGet({ key_id: kid });
    jwk = data.key;
    // Plaid keys expire after 5 minutes — cache with TTL
    jwkCache.set(kid, jwk);
    setTimeout(() => jwkCache.delete(kid), 5 * 60 * 1000);
  }

  const { importJWK, jwtVerify, createHash } = await import('jose');
  const key = await importJWK(jwk, alg);
  const { payload } = await jwtVerify(token, key, { maxTokenAge: '5 minutes' });

  const bodyHash = require('crypto').createHash('sha256').update(rawBody).digest('hex');
  if (payload.request_body_sha256 !== bodyHash) throw new Error('Body hash mismatch');
}

router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const rawBody = req.body;
  const verificationToken = req.headers['plaid-verification'];

  if (verificationToken) {
    try {
      await verifyPlaidWebhook(verificationToken, rawBody);
    } catch (err) {
      console.error('Plaid webhook verification failed:', err.message);
      return res.status(400).json({ error: 'Webhook verification failed' });
    }
  }

  const body = JSON.parse(rawBody.toString());
  const { webhook_type, webhook_code, item_id } = body;
  console.log(`Plaid webhook: ${webhook_type}/${webhook_code} item=${item_id}`);

  if (webhook_type === 'TRANSACTIONS' && ['DEFAULT_UPDATE', 'INITIAL_UPDATE', 'HISTORICAL_UPDATE'].includes(webhook_code)) {
    // New transactions available — real-time push can be added later
  }

  if (webhook_type === 'ITEM') {
    if (['ITEM_LOGIN_REQUIRED', 'PENDING_EXPIRATION', 'PENDING_DISCONNECT'].includes(webhook_code)) {
      db.prepare('UPDATE plaid_tokens SET needs_update = 1 WHERE item_id = ?').run(item_id);
      console.log(`Item needs re-auth: ${item_id} (${webhook_code})`);
    }
    if (webhook_code === 'ERROR') {
      console.warn(`Plaid item error for item ${item_id}:`, body.error);
      if (body.error?.error_code === 'ITEM_LOGIN_REQUIRED') {
        db.prepare('UPDATE plaid_tokens SET needs_update = 1 WHERE item_id = ?').run(item_id);
      }
    }
    // User revoked access at their bank — remove the item entirely
    if (webhook_code === 'USER_PERMISSION_REVOKED') {
      const row = db.prepare('SELECT access_token FROM plaid_tokens WHERE item_id = ?').get(item_id);
      if (row) {
        try { await plaidClient.itemRemove({ access_token: row.access_token }); } catch {}
      }
      db.prepare('DELETE FROM plaid_tokens WHERE item_id = ?').run(item_id);
      console.log(`User revoked access, item removed: ${item_id}`);
    }
  }

  res.json({ received: true });
});

module.exports = router;
module.exports.plaidClient = plaidClient;
