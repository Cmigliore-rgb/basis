const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const store = require('../store');
const requireAuth = require('../middleware/requireAuth');
const email = require('../email');
const db = require('../db');

function unsubToken(userId) {
  return crypto.createHmac('sha256', process.env.JWT_SECRET || 'ledger_secret')
    .update(String(userId)).digest('hex').slice(0, 24);
}

function unsubLink(userId) {
  const base = process.env.APP_URL || 'https://peakledger.app';
  return `${base}/api/notifications/unsubscribe?uid=${userId}&sig=${unsubToken(userId)}`;
}

// GET /api/notifications/prefs
router.get('/prefs', requireAuth, (req, res) => {
  const prefs = (req.app.locals.notificationPrefs || {})[req.user.id] || {};
  res.json({ prefs, emailConfigured: email.isConfigured() });
});

// PUT /api/notifications/prefs
router.put('/prefs', requireAuth, (req, res) => {
  const all = req.app.locals.notificationPrefs || {};
  all[req.user.id] = { ...(all[req.user.id] || {}), ...req.body };
  req.app.locals.notificationPrefs = all;
  store.save(req.app);
  res.json({ ok: true });
});

// POST /api/notifications/send  — triggered by frontend when a condition is met
router.post('/send', requireAuth, async (req, res) => {
  const { type, subject, details } = req.body;
  const prefs = (req.app.locals.notificationPrefs || {})[req.user.id] || {};
  if (prefs.emailUnsubscribed && type !== 'test') return res.json({ ok: true, skipped: true });
  const to = prefs.email || req.user.email;
  const unsub = unsubLink(req.user.id);
  const unsubFooter = `<p style="color:#aaa;font-size:11px;margin-top:24px;padding-top:16px;border-top:1px solid #eee">
    You're receiving this because you enabled PeakLedger alerts.
    <a href="${unsub}" style="color:#aaa">Unsubscribe</a>
  </p>`;

  const bodies = {
    budget_alert: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
        <h2 style="color:#1a1a1a;margin-bottom:8px">Budget Alert</h2>
        <p style="color:#555;font-size:15px">${details?.message || 'A budget category has exceeded its limit.'}</p>
        ${details?.category ? `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:14px 18px;margin:20px 0">
          <strong>${details.category}</strong>: ${details.spent} of ${details.limit} limit (${details.pct}%)
        </div>` : ''}
        <p style="color:#888;font-size:13px;margin-top:24px">Open PeakLedger to review your spending.</p>
        ${unsubFooter}
      </div>`,
    goal_reached: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
        <h2 style="color:#16a34a;margin-bottom:8px">Goal Reached! 🎉</h2>
        <p style="color:#555;font-size:15px">You've hit your savings goal: <strong>${details?.goalName || 'Savings Goal'}</strong></p>
        <p style="color:#888;font-size:13px;margin-top:24px">Log in to PeakLedger to celebrate and set your next goal.</p>
        ${unsubFooter}
      </div>`,
    low_balance: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
        <h2 style="color:#dc2626;margin-bottom:8px">Low Balance Alert</h2>
        <p style="color:#555;font-size:15px">${details?.accountName || 'An account'} is below your threshold: <strong>${details?.balance}</strong></p>
        <p style="color:#888;font-size:13px;margin-top:24px">Open PeakLedger to review your accounts.</p>
        ${unsubFooter}
      </div>`,
    test: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
        <h2 style="color:#1a1a1a;margin-bottom:8px">PeakLedger Notifications are working ✓</h2>
        <p style="color:#555;font-size:15px">Your email notifications are configured correctly. You'll receive alerts here for budget overruns, goals reached, and low balances.</p>
        ${unsubFooter}
      </div>`,
  };

  try {
    await email.send({ to, subject: subject || 'PeakLedger Alert', html: bodies[type] || bodies.test });
    res.json({ ok: true, to });
  } catch (e) {
    res.status(503).json({ error: e.message });
  }
});

// GET /api/notifications/unsubscribe — one-click unsubscribe from email link
router.get('/unsubscribe', (req, res) => {
  const { uid, sig } = req.query;
  if (!uid || !sig || sig !== unsubToken(uid)) {
    return res.status(400).send('<p>Invalid or expired unsubscribe link.</p>');
  }
  const all = req.app.locals.notificationPrefs || {};
  all[uid] = { ...(all[uid] || {}), emailUnsubscribed: true };
  req.app.locals.notificationPrefs = all;
  store.save(req.app);
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Unsubscribed</title></head><body style="font-family:sans-serif;max-width:480px;margin:80px auto;text-align:center;color:#333"><h2>You've been unsubscribed</h2><p style="color:#666">You won't receive any more email alerts from PeakLedger.<br>You can re-enable them anytime in your Settings.</p><a href="https://peakledger.app" style="color:#3b82f6">Back to PeakLedger</a></body></html>`);
});

// GET /api/notifications/inbox
router.get('/inbox', requireAuth, (req, res) => {
  const notifs = db.prepare(
    'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50'
  ).all(req.user.id);
  const unread = notifs.filter(n => !n.read).length;
  res.json({ notifications: notifs, unread });
});

// POST /api/notifications/inbox  — professor or admin sends to a list of user IDs
router.post('/inbox', requireAuth, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'professor') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { user_ids, title, body, type = 'announcement' } = req.body;
  if (!user_ids?.length || !title) {
    return res.status(400).json({ error: 'user_ids and title required' });
  }
  const insert = db.prepare(
    'INSERT INTO notifications (user_id, type, title, body) VALUES (?, ?, ?, ?)'
  );
  const insertMany = db.transaction(ids => {
    ids.forEach(uid => insert.run(uid, type, title, body || ''));
  });
  insertMany(user_ids);
  res.json({ ok: true, count: user_ids.length });
});

// PATCH /api/notifications/inbox/read-all
router.patch('/inbox/read-all', requireAuth, (req, res) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(req.user.id);
  res.json({ ok: true });
});

// PATCH /api/notifications/inbox/:id/read
router.patch('/inbox/:id/read', requireAuth, (req, res) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?')
    .run(Number(req.params.id), req.user.id);
  res.json({ ok: true });
});

module.exports = router;
