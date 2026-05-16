const express = require('express');
const router = express.Router();
const store = require('../store');
const requireAuth = require('../middleware/requireAuth');
const email = require('../email');

const escapeHtml = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// POST /api/feedback — save feedback and email support
router.post('/', requireAuth, async (req, res) => {
  const { rating, subject, message } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: 'message required' });

  const entry = {
    id: Date.now().toString(),
    userId: req.user.id,
    userEmail: req.user.email,
    rating: rating || null,
    subject: subject?.trim() || null,
    message: message.trim(),
    createdAt: new Date().toISOString(),
  };

  req.app.locals.feedback = [...(req.app.locals.feedback || []), entry];
  store.save(req.app);

  if (email.isConfigured()) {
    const stars = rating ? '★'.repeat(rating) + '☆'.repeat(5 - rating) : 'No rating';
    email.send({
      to: 'support@peakledger.app',
      subject: subject?.trim() ? `Feedback: ${subject.trim()}` : `Feedback: ${stars}`,
      html: `<div style="font-family:sans-serif;max-width:520px;padding:24px">
        <h2 style="margin-bottom:8px">New Feedback</h2>
        <p><strong>From:</strong> ${escapeHtml(req.user.name)} (${escapeHtml(req.user.email)})</p>
        <p><strong>Rating:</strong> ${stars}</p>
        ${subject?.trim() ? `<p><strong>Subject:</strong> ${escapeHtml(subject.trim())}</p>` : ''}
        <div style="background:#f5f5f5;border-radius:8px;padding:14px 18px;margin:16px 0;font-size:15px;color:#333;white-space:pre-wrap">${escapeHtml(message.trim())}</div>
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
