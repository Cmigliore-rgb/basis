// Central data controller.
// No linked tokens → Athens, GA demo dataset.
// Linked tokens present → real Plaid data.
// Both paths return the same shape so all routes, charts, and AI work unchanged.

const { plaidClient } = require('./routes/plaid');
const getDummyData = require('./dummy_data');

async function getAccounts(req) {
  const tokens = req.app.locals.accessTokens || [];
  if (!tokens.length) return { accounts: getDummyData().accounts, demo: true };

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
  const tokens = req.app.locals.accessTokens || [];
  if (!tokens.length) {
    const { transactions } = getDummyData();
    return {
      transactions: transactions
        .filter(t => t.date >= start && t.date <= end)
        .sort((a, b) => new Date(b.date) - new Date(a.date)),
    };
  }

  const all = await Promise.all(
    tokens.map(({ access_token }) =>
      plaidClient.transactionsGet({ access_token, start_date: start, end_date: end })
        .then(r => r.data.transactions)
        .catch(() => [])
    )
  );

  return {
    transactions: all.flat().sort((a, b) => new Date(b.date) - new Date(a.date)),
  };
}

async function getHoldings(req) {
  const tokens = req.app.locals.accessTokens || [];
  if (!tokens.length) return { holdings: getDummyData().holdings };

  const results = await Promise.all(
    tokens.map(({ access_token }) =>
      plaidClient.investmentsHoldingsGet({ access_token })
        .then(r => ({ holdings: r.data.holdings, securities: r.data.securities }))
        .catch(() => ({ holdings: [], securities: [] }))
    )
  );

  const securitiesMap = {};
  results.forEach(({ securities }) => {
    securities.forEach(s => { securitiesMap[s.security_id] = s; });
  });

  return {
    holdings: results
      .flatMap(({ holdings }) => holdings)
      .map(h => ({ ...h, security: securitiesMap[h.security_id] || {} })),
  };
}

module.exports = { getAccounts, getTransactions, getHoldings };
