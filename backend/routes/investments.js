const express = require('express');
const router = express.Router();
const { plaidClient } = require('./plaid');

router.get('/holdings', async (req, res) => {
  const tokens = req.app.locals.accessTokens || [];
  if (!tokens.length) return res.json({ holdings: [] });
  try {
    const results = await Promise.all(
      tokens.map(({ access_token }) =>
        plaidClient.investmentsHoldingsGet({ access_token })
          .then(r => ({ holdings: r.data.holdings, securities: r.data.securities }))
          .catch(err => {
            console.error('holdings fetch error:', err.response?.data || err.message);
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
    res.json({ holdings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
