const express = require('express');
const router = express.Router();
const store = require('../store');

router.get('/limits', (req, res) => {
  res.json({ limits: req.app.locals.budgetLimits || {} });
});

router.post('/limits', (req, res) => {
  const { category, limit } = req.body;
  if (!category) return res.status(400).json({ error: 'category required' });

  if (!req.app.locals.budgetLimits) req.app.locals.budgetLimits = {};

  if (limit === null || limit === undefined || limit === '') {
    delete req.app.locals.budgetLimits[category];
  } else {
    req.app.locals.budgetLimits[category] = parseFloat(limit);
  }

  store.save(req.app);
  res.json({ limits: req.app.locals.budgetLimits });
});

module.exports = router;
