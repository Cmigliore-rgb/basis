const express = require('express');
const router = express.Router();
const db = require('../db');
const requireAuth = require('../middleware/requireAuth');

// POST /submissions — submit or re-submit an assignment
router.post('/', requireAuth, (req, res) => {
  const { assignment_id, course_code, notes } = req.body;
  if (!assignment_id || !course_code) {
    return res.status(400).json({ error: 'assignment_id and course_code are required' });
  }
  try {
    db.prepare(`
      INSERT OR REPLACE INTO submissions (user_id, assignment_id, course_code, notes, submitted_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).run(req.user.id, assignment_id, course_code.toUpperCase(), notes || '');
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Submission failed' });
  }
});

// GET /submissions/my — current user's submitted assignment IDs
router.get('/my', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT assignment_id, course_code, notes, grade, feedback, submitted_at
    FROM submissions WHERE user_id = ?
    ORDER BY submitted_at DESC
  `).all(req.user.id);
  res.json({
    submissions: rows,
    submittedIds: rows.map(r => r.assignment_id),
  });
});

module.exports = router;
