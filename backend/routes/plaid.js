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
  const { institution_id } = req.body || {};
  try {
    const base = {
      user: { client_user_id: String(req.user.id) },
      client_name: 'PeakLedger',
      products: [Products.Transactions],
      optional_products: [Products.Investments, Products.Liabilities],
      country_codes: [CountryCode.Us],
      language: 'en',
      webhook: 'https://peakledger.app/api/plaid/webhook',
    };
    if (process.env.PLAID_REDIRECT_URI) base.redirect_uri = process.env.PLAID_REDIRECT_URI;

    // When pre-selecting an institution, omit account_filters — they conflict with
    // institution_id for institutions that don't offer every filtered subtype.
    if (institution_id) {
      try {
        const r = await plaidClient.linkTokenCreate({ ...base, institution_id });
        return res.json({ link_token: r.data.link_token });
      } catch {
        // Institution ID rejected — fall through to generic token without pre-selection
      }
    }

    base.account_filters = {
      depository: { account_subtypes: ['checking', 'savings'] },
      credit:     { account_subtypes: ['credit card'] },
      investment: { account_subtypes: ['brokerage', 'ira', 'roth', '401k'] },
      loan:       { account_subtypes: ['student', 'mortgage', 'auto'] },
    };
    const response = await plaidClient.linkTokenCreate(base);
    res.json({ link_token: response.data.link_token });
  } catch (err) {
    console.error('create_link_token error:', JSON.stringify(err.response?.data || err.message));
    res.status(500).json({ error: 'Failed to create link token' });
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
    console.error('create_update_token error:', JSON.stringify(err.response?.data || err.message));
    res.status(500).json({ error: 'Failed to create update token' });
  }
});

router.post('/exchange_token', requireAuth, async (req, res) => {
  const { public_token, institution_name } = req.body;
  try {
    // Plaid connections are premium-only
    const userRow = db.prepare('SELECT tier FROM users WHERE id = ?').get(req.user.id);
    if (userRow?.tier !== 'premium') {
      return res.status(403).json({ error: 'Connecting bank accounts requires a premium account.' });
    }

    // Total institution cap for premium users
    const totalCount = db.prepare('SELECT COUNT(*) as cnt FROM plaid_tokens WHERE user_id = ?').get(req.user.id)?.cnt || 0;
    if (totalCount >= 8) {
      return res.status(429).json({ error: 'Account limit reached. Premium accounts can connect up to 8 institutions.' });
    }

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

    // Background initial sync — don't await, user proceeds immediately
    const newToken = db.prepare('SELECT * FROM plaid_tokens WHERE item_id = ? AND user_id = ?').get(item_id, req.user.id);
    if (newToken) {
      const { syncTransactions, syncAccounts } = require('../sync');
      Promise.all([syncTransactions(newToken), syncAccounts(newToken)])
        .catch(e => console.error('[post-connect sync]', e.message));
    }

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
    res.status(500).json({ error: 'Failed to load accounts' });
  }
});

router.get('/liabilities', requireAuth, async (req, res) => {
  try {
    const { getLiabilities } = require('../data_controller');
    res.json(await getLiabilities(req));
  } catch (err) {
    console.error('liabilities error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to load liabilities' });
  }
});

router.delete('/disconnect/:id', requireAuth, async (req, res) => {
  const row = db.prepare('SELECT access_token FROM plaid_tokens WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (row) {
    try { await plaidClient.itemRemove({ access_token: row.access_token }); } catch (e) {
      console.warn('itemRemove error (continuing):', e.message);
    }
  }
  // Clean up cached data for this token before removing the token
  db.prepare('DELETE FROM accounts_cache WHERE token_id = ?').run(req.params.id);
  db.prepare('DELETE FROM transactions_cache WHERE token_id = ?').run(req.params.id);
  db.prepare('DELETE FROM plaid_tokens WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ success: true });
});

// ── Institution logo proxy (serves Plaid-hosted PNG so frontend doesn't need credentials) ──
const logoCache = new Map();
router.get('/institution_logo/:id', async (req, res) => {
  const { id } = req.params;
  if (!/^ins_[\w]+$/.test(id)) return res.status(400).end();

  if (logoCache.has(id)) {
    const { png, ts } = logoCache.get(id);
    if (Date.now() - ts < 24 * 60 * 60 * 1000) {
      res.set('Content-Type', 'image/png');
      res.set('Cache-Control', 'public, max-age=86400');
      return res.send(png);
    }
  }

  try {
    const { data } = await plaidClient.institutionsGetById({
      institution_id: id,
      country_codes: ['US'],
      options: { include_optional_metadata: true },
    });
    const b64 = data.institution.logo;
    if (!b64) return res.status(404).end();
    const png = Buffer.from(b64, 'base64');
    logoCache.set(id, { png, ts: Date.now() });
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(png);
  } catch {
    res.status(404).end();
  }
});

router.get('/cache-status', requireAuth, (req, res) => {
  const tokens = db.prepare('SELECT id, institution_name, sync_cursor FROM plaid_tokens WHERE user_id = ?').all(req.user.id);
  const txnCount = db.prepare('SELECT COUNT(*) as c FROM transactions_cache WHERE user_id = ?').get(req.user.id)?.c || 0;
  const acctCount = db.prepare('SELECT COUNT(*) as c FROM accounts_cache WHERE user_id = ?').get(req.user.id)?.c || 0;
  res.json({ tokens, txnCount, acctCount });
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

// ── Manual sync: force-refresh cache for all connected accounts ───────────
router.post('/sync', requireAuth, async (req, res) => {
  try {
    const { syncAll } = require('../sync');
    await syncAll(req.user.id);
    res.json({ success: true });
  } catch (err) {
    console.error('manual sync error:', err.message);
    res.status(500).json({ error: err.message });
  }
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

router.post('/webhook', async (req, res) => {
  // raw body already captured by app-level express.raw() in server.js
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
    const tokenRow = db.prepare('SELECT * FROM plaid_tokens WHERE item_id = ?').get(item_id);
    if (tokenRow) {
      const { syncTransactions, syncAccounts } = require('../sync');
      Promise.all([syncTransactions(tokenRow), syncAccounts(tokenRow)])
        .catch(e => console.error('[webhook sync]', e.message));
    }
  }

  if (webhook_type === 'HOLDINGS' && webhook_code === 'DEFAULT_UPDATE') {
    console.log(`Holdings ready for item ${item_id} — user can now refresh investments`);
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
