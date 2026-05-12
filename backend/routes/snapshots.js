const express = require('express');
const router = express.Router();
const db = require('../db');
const requireAuth = require('../middleware/requireAuth');

// Record today's net worth snapshot (upsert — one per user per day)
router.post('/', requireAuth, (req, res) => {
  const { netWorth } = req.body;
  if (typeof netWorth !== 'number') return res.status(400).json({ error: 'netWorth required' });

  const today = new Date().toISOString().slice(0, 10);
  db.prepare(`
    INSERT INTO net_worth_snapshots (user_id, date, value)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id, date) DO UPDATE SET value = excluded.value
  `).run(req.user.id, today, netWorth);

  res.json({ ok: true });
});

// Get last 90 days of snapshots for the authenticated user
router.get('/', requireAuth, (req, res) => {
  const snapshots = db.prepare(`
    SELECT date, value FROM net_worth_snapshots
    WHERE user_id = ?
    ORDER BY date ASC
    LIMIT 90
  `).all(req.user.id);
  res.json({ snapshots });
});

module.exports = router;
