const { plaidClient } = require('./routes/plaid');
const getDummyData = require('./dummy_data');
const db = require('./db');

function getUserTokens(userId) {
  return db.prepare('SELECT * FROM plaid_tokens WHERE user_id = ?').all(userId);
}

const STALE_MS = 30 * 60 * 1000; // 30 minutes

function isStale(userId) {
  const row = db.prepare('SELECT MIN(last_synced_at) as t FROM plaid_tokens WHERE user_id = ?').get(userId);
  if (!row?.t) return true;
  return Date.now() - new Date(row.t).getTime() > STALE_MS;
}

function bgSync(userId) {
  const { syncAll } = require('./sync');
  syncAll(userId).catch(e => console.warn('[bg-sync]', e.message));
}

async function getAccounts(req) {
  const tokens = getUserTokens(req.user.id);
  if (!tokens.length) return { accounts: getDummyData().accounts, demo: true };

  const cached = db.prepare('SELECT raw_json FROM accounts_cache WHERE user_id = ?').all(req.user.id);
  if (cached.length) {
    if (isStale(req.user.id)) {
      console.log(`[getAccounts] user=${req.user.id} cache=hit stale=true — bg sync triggered`);
      bgSync(req.user.id);
    } else {
      console.log(`[getAccounts] user=${req.user.id} cache=hit stale=false`);
    }
    return { accounts: cached.map(r => JSON.parse(r.raw_json)) };
  }

  console.log(`[getAccounts] user=${req.user.id} cache=miss — syncing now`);
  try {
    const { syncAll } = require('./sync');
    await syncAll(req.user.id);
    const fresh = db.prepare('SELECT raw_json FROM accounts_cache WHERE user_id = ?').all(req.user.id);
    if (fresh.length) return { accounts: fresh.map(r => JSON.parse(r.raw_json)) };
  } catch (e) {
    console.warn('[getAccounts] sync error:', e.message);
  }

  console.warn('[getAccounts] falling back to live Plaid');
  const all = await Promise.all(
    tokens.map(async ({ access_token, institution_name }) => {
      const r = await plaidClient.accountsGet({ access_token });
      return r.data.accounts.map(a => ({ ...a, institution_name }));
    })
  );
  const seen = new Set();
  return {
    accounts: all.flat().filter(a => {
      if (seen.has(a.account_id)) return false;
      seen.add(a.account_id);
      return true;
    }),
  };
}

async function getTransactions(req, start, end) {
  const tokens = getUserTokens(req.user.id);
  if (!tokens.length) {
    const { transactions } = getDummyData();
    return {
      transactions: transactions
        .filter(t => t.date >= start && t.date <= end)
        .sort((a, b) => new Date(b.date) - new Date(a.date)),
    };
  }

  const hasCache = db.prepare('SELECT 1 FROM transactions_cache WHERE user_id = ? LIMIT 1').get(req.user.id);
  if (hasCache) {
    if (isStale(req.user.id)) {
      console.log(`[getTransactions] user=${req.user.id} cache=hit stale=true — bg sync triggered`);
      bgSync(req.user.id);
    } else {
      console.log(`[getTransactions] user=${req.user.id} cache=hit stale=false`);
    }
    const rows = db.prepare(
      'SELECT raw_json FROM transactions_cache WHERE user_id = ? AND date >= ? AND date <= ? ORDER BY date DESC'
    ).all(req.user.id, start, end);
    return { transactions: rows.map(r => JSON.parse(r.raw_json)) };
  }

  console.log(`[getTransactions] user=${req.user.id} cache=miss — syncing now`);
  try {
    const { syncAll } = require('./sync');
    await syncAll(req.user.id);
  } catch (e) {
    console.warn('[getTransactions] sync error:', e.message);
  }

  const rows = db.prepare(
    'SELECT raw_json FROM transactions_cache WHERE user_id = ? AND date >= ? AND date <= ? ORDER BY date DESC'
  ).all(req.user.id, start, end);

  if (!rows.length) {
    console.warn('[getTransactions] cache still empty — falling back to live Plaid');
    const all = await Promise.all(
      tokens.map(({ access_token }) =>
        plaidClient.transactionsGet({ access_token, start_date: start, end_date: end })
          .then(r => r.data.transactions)
          .catch(() => [])
      )
    );
    return { transactions: all.flat().sort((a, b) => new Date(b.date) - new Date(a.date)) };
  }

  return { transactions: rows.map(r => JSON.parse(r.raw_json)) };
}

async function getHoldings(req) {
  const tokens = getUserTokens(req.user.id);
  if (!tokens.length) return { holdings: getDummyData().holdings, demo: true };

  const results = await Promise.all(
    tokens.map(({ access_token, institution_name }) =>
      plaidClient.investmentsHoldingsGet({ access_token })
        .then(r => ({ holdings: r.data.holdings, securities: r.data.securities }))
        .catch(err => {
          const code = err.response?.data?.error_code;
          const msg  = err.response?.data?.error_message || err.message;
          console.warn(`[holdings] ${institution_name}: ${code} — ${msg}`);
          return { holdings: [], securities: [] };
        })
    )
  );

  const securitiesMap = {};
  results.forEach(({ securities }) => {
    securities.forEach(s => { securitiesMap[s.security_id] = s; });
  });

  const holdings = results
    .flatMap(({ holdings }) => holdings)
    .map(h => ({ ...h, security: securitiesMap[h.security_id] || {} }));

  // User has bank accounts connected but no brokerage — don't show demo investments
  if (!holdings.length) return { holdings: [], noBrokerage: true };

  return { holdings };
}

function getManualLiabilities(userId) {
  return db.prepare('SELECT * FROM manual_liabilities WHERE user_id = ? ORDER BY created_at ASC').all(userId);
}

function manualToPlaidShape(row) {
  const base = {
    account_id: `manual_${row.id}`,
    _manual: true,
    _id: row.id,
    _name: row.name,
    balances: { current: row.balance, limit: row.credit_limit || null, iso_currency_code: 'USD' },
    minimum_payment_amount: row.minimum_payment || null,
    next_payment_due_date: row.due_day ? (() => {
      const d = new Date();
      d.setDate(row.due_day);
      if (d <= new Date()) d.setMonth(d.getMonth() + 1);
      return d.toISOString().split('T')[0];
    })() : null,
  };
  if (row.type === 'credit') base.aprs = row.interest_rate != null ? [{ apr_type: 'purchase_apr', apr_percentage: row.interest_rate }] : [];
  if (row.type === 'student') base.interest_rate_percentage = row.interest_rate;
  if (row.type === 'mortgage') base.interest_rate = { percentage: row.interest_rate };
  return base;
}

async function getLiabilities(req) {
  const tokens = getUserTokens(req.user.id);
  const manual = getManualLiabilities(req.user.id);
  const manualByType = { credit: [], student: [], mortgage: [] };
  manual.forEach(row => manualByType[row.type]?.push(manualToPlaidShape(row)));

  if (!tokens.length) {
    const demo = getDummyData().liabilities;
    return {
      credit:   [...demo.credit,   ...manualByType.credit],
      student:  [...demo.student,  ...manualByType.student],
      mortgage: [...demo.mortgage, ...manualByType.mortgage],
      demo: true,
    };
  }

  const results = await Promise.all(
    tokens.map(({ access_token }) =>
      plaidClient.liabilitiesGet({ access_token })
        .then(r => ({ liabilities: r.data.liabilities, accounts: r.data.accounts || [] }))
        .catch(() => null)
    )
  );

  // Plaid puts balances in the top-level accounts array, not in the liability objects
  const balanceMap = {};
  results.forEach(r => {
    (r?.accounts || []).forEach(a => { balanceMap[a.account_id] = a.balances; });
  });

  return {
    credit:   [...results.flatMap(r => (r?.liabilities?.credit   || []).map(c => ({ ...c, balances: balanceMap[c.account_id] || c.balances }))), ...manualByType.credit],
    student:  [...results.flatMap(r => (r?.liabilities?.student  || []).map(s => ({ ...s, balances: balanceMap[s.account_id] || s.balances }))), ...manualByType.student],
    mortgage: [...results.flatMap(r => (r?.liabilities?.mortgage || []).map(m => ({ ...m, balances: balanceMap[m.account_id] || m.balances }))), ...manualByType.mortgage],
  };
}

module.exports = { getAccounts, getTransactions, getHoldings, getLiabilities };
