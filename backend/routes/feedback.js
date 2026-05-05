const express = require('express');
const router = express.Router();
const store = require('../store');
const requireAuth = require('../middleware/requireAuth');
const email = require('../email');

// POST /api/feedback
router.post('/', requireAuth, async (req, res) => {
  const { rating, message } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: 'message required' });

  const entry = {
    id: Date.now().toString(),
    userId: req.user.id,
    userEmail: req.user.email,
    rating: rating || null,
    message: message.trim(),
    createdAt: new Date().toISOString(),
  };

  req.app.locals.feedback = [...(req.app.locals.feedback || []), entry];
  store.save(req.app);

  // Email notification to admin if configured
  const ADMIN = process.env.ADMIN_EMAILS?.split(',')[0]?.trim();
  if (ADMIN && email.isConfigured()) {
    const stars = rating ? '★'.repeat(rating) + '☆'.repeat(5 - rating) : 'No rating';
    email.send({
      to: ADMIN,
      subject: `Merit Feedback: ${stars}`,
      html: `<div style="font-family:sans-serif;max-width:520px;padding:24px">
        <h2 style="margin-bottom:8px">New Feedback</h2>
        <p><strong>From:</strong> ${req.user.email}</p>
        <p><strong>Rating:</strong> ${stars}</p>
        <div style="background:#f5f5f5;border-radius:8px;padding:14px 18px;margin:16px 0;font-size:15px;color:#333">${message.trim()}</div>
      </div>`,
    }).catch(() => {});
  }

  res.json({ ok: true });
});

// GET /api/feedback  (admin only)
router.get('/', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  res.json({ feedback: req.app.locals.feedback || [] });
});

module.exports = router;
