const db = require('./db');

function getPlaidClient() {
  return require('./routes/plaid').plaidClient;
}

async function syncTransactions(tokenRow) {
  const { id: tokenId, user_id, access_token, institution_name } = tokenRow;
  const plaidClient = getPlaidClient();
  let cursor = tokenRow.sync_cursor || undefined;
  let hasMore = true;

  const upsert = db.prepare(`
    INSERT OR REPLACE INTO transactions_cache (transaction_id, user_id, token_id, date, pending, raw_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const del = db.prepare('DELETE FROM transactions_cache WHERE user_id = ? AND transaction_id = ?');

  while (hasMore) {
    const params = { access_token, count: 500 };
    if (cursor) params.cursor = cursor;

    const { data } = await plaidClient.transactionsSync(params);
    const { added, modified, removed, next_cursor, has_more } = data;

    db.transaction(() => {
      for (const t of [...added, ...modified]) {
        upsert.run(t.transaction_id, user_id, tokenId, t.date, t.pending ? 1 : 0, JSON.stringify({ ...t, institution_name }));
      }
      for (const t of removed) {
        del.run(user_id, t.transaction_id);
      }
    })();

    cursor = next_cursor;
    hasMore = has_more;
  }

  if (cursor) {
    db.prepare('UPDATE plaid_tokens SET sync_cursor = ? WHERE id = ?').run(cursor, tokenId);
  }
  console.log(`[sync:txns] ${institution_name} done — cursor updated`);
}

async function syncAccounts(tokenRow) {
  const { id: tokenId, user_id, access_token, institution_name } = tokenRow;
  const plaidClient = getPlaidClient();
  const { data } = await plaidClient.accountsGet({ access_token });

  db.transaction(() => {
    db.prepare('DELETE FROM accounts_cache WHERE token_id = ?').run(tokenId);
    const insert = db.prepare(`
      INSERT INTO accounts_cache (account_id, user_id, token_id, type, raw_json, synced_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `);
    for (const a of data.accounts) {
      insert.run(a.account_id, user_id, tokenId, a.type, JSON.stringify({ ...a, institution_name }));
    }
  })();
  console.log(`[sync:accts] ${institution_name} — ${data.accounts.length} accounts cached`);
}

async function syncAll(userId) {
  const tokens = db.prepare('SELECT * FROM plaid_tokens WHERE user_id = ?').all(userId);
  await Promise.all(tokens.map(t =>
    Promise.all([
      syncTransactions(t).catch(e => console.warn(`[sync:txns] ${t.institution_name}:`, e.message)),
      syncAccounts(t).catch(e => console.warn(`[sync:accts] ${t.institution_name}:`, e.message)),
    ])
  ));
}

module.exports = { syncTransactions, syncAccounts, syncAll };
