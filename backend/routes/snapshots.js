const express = require('express');
const router = express.Router();
const store = require('../store');

// Record a net worth snapshot (one per day, latest wins)
router.post('/', (req, res) => {
  const { netWorth } = req.body;
  if (typeof netWorth !== 'number') return res.status(400).json({ error: 'netWorth required' });

  const today = new Date().toISOString().slice(0, 10);
  const snapshots = req.app.locals.snapshots || [];

  const existing = snapshots.findIndex(s => s.date === today);
  if (existing >= 0) {
    snapshots[existing].value = netWorth;
  } else {
    snapshots.push({ date: today, value: netWorth });
  }

  // Keep last 90 days
  snapshots.sort((a, b) => a.date.localeCompare(b.date));
  req.app.locals.snapshots = snapshots.slice(-90);
  store.save(req.app);

  res.json({ ok: true });
});

router.get('/', (req, res) => {
  res.json({ snapshots: req.app.locals.snapshots || [] });
});

module.exports = router;
