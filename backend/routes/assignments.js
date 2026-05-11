const express = require('express');
const router = express.Router();
const db = require('../db');
const requireAuth = require('../middleware/requireAuth');

// GET /assignments/:code — custom assignments for a course (any authenticated user)
router.get('/:code', requireAuth, (req, res) => {
  const code = req.params.code.toUpperCase();
  const assignments = db.prepare(`
    SELECT a.*, c.course_id
    FROM assignments a
    JOIN course_codes c ON a.course_code = c.code
    WHERE a.course_code = ?
    ORDER BY a.created_at ASC
  `).all(code);
  res.json({ assignments });
});

module.exports = router;
