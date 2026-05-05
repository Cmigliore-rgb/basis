const express = require('express');
const router = express.Router();
const db = require('../db');
const requireAuth = require('../middleware/requireAuth');

function requireProfessor(req, res, next) {
  if (req.user.role !== 'professor' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Professor access required' });
  }
  next();
}

// GET /professor/dashboard — all course codes with enrollment + submission counts
router.get('/dashboard', requireAuth, requireProfessor, (req, res) => {
  const codes = db.prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM enrollments e WHERE e.course_code = c.code) AS student_count,
      (SELECT COUNT(*) FROM submissions s WHERE s.course_code = c.code) AS submission_count
    FROM course_codes c
    ORDER BY c.created_at DESC
  `).all();
  res.json({ codes });
});

// GET /professor/students/:code — enrolled students for a course
router.get('/students/:code', requireAuth, requireProfessor, (req, res) => {
  const code = req.params.code.toUpperCase();
  const students = db.prepare(`
    SELECT u.id, u.name, u.email, u.role, u.tier, e.enrolled_at
    FROM enrollments e JOIN users u ON e.user_id = u.id
    WHERE e.course_code = ?
    ORDER BY e.enrolled_at DESC
  `).all(code);
  res.json({ students });
});

// GET /professor/submissions/:code — submissions for a course
router.get('/submissions/:code', requireAuth, requireProfessor, (req, res) => {
  const code = req.params.code.toUpperCase();
  const submissions = db.prepare(`
    SELECT s.*, u.name AS student_name, u.email AS student_email
    FROM submissions s JOIN users u ON s.user_id = u.id
    WHERE s.course_code = ?
    ORDER BY s.submitted_at DESC
  `).all(code);
  res.json({ submissions });
});

// POST /professor/codes — create a new course code
router.post('/codes', requireAuth, requireProfessor, (req, res) => {
  const { code, course_id, course_name, semester } = req.body;
  if (!code || !course_id || !course_name) {
    return res.status(400).json({ error: 'code, course_id, and course_name are required' });
  }
  try {
    db.prepare(`
      INSERT INTO course_codes (code, course_id, course_name, instructor_name, semester)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      code.toUpperCase().trim(),
      course_id.trim(),
      course_name.trim(),
      req.user.name || 'Staff',
      semester || 'Spring 2026'
    );
    const row = db.prepare('SELECT * FROM course_codes WHERE code = ?').get(code.toUpperCase().trim());
    res.status(201).json({ code: row });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'That code already exists' });
    res.status(500).json({ error: 'Failed to create code' });
  }
});

// PATCH /professor/submissions/:id — grade a submission
router.patch('/submissions/:id', requireAuth, requireProfessor, async (req, res) => {
  const id = parseInt(req.params.id);
  const { grade, feedback, assignmentTitle, assignmentPoints } = req.body;
  if (grade == null) return res.status(400).json({ error: 'grade is required' });

  db.prepare('UPDATE submissions SET grade = ?, feedback = ? WHERE id = ?')
    .run(parseInt(grade), feedback || '', id);

  const updated = db.prepare(`
    SELECT s.*, u.name AS student_name, u.email AS student_email
    FROM submissions s JOIN users u ON s.user_id = u.id WHERE s.id = ?
  `).get(id);

  const { send, isConfigured } = require('../email');
  if (isConfigured()) {
    const pct = assignmentPoints ? Math.round((parseInt(grade) / assignmentPoints) * 100) : null;
    const letterGrade = pct == null ? '' : pct >= 90 ? 'A' : pct >= 80 ? 'B' : pct >= 70 ? 'C' : pct >= 60 ? 'D' : 'F';
    send({
      to: updated.student_email,
      subject: `Grade posted: ${assignmentTitle || updated.assignment_id}`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#0f0f0f;color:#f0f0f0;border-radius:12px">
          <div style="font-size:22px;font-weight:800;letter-spacing:-0.5px;margin-bottom:4px">Basis</div>
          <div style="font-size:13px;color:#8e8e93;margin-bottom:28px">Grade Notification</div>
          <div style="font-size:16px;font-weight:700;margin-bottom:6px">Hi ${updated.student_name},</div>
          <p style="font-size:14px;color:#c0c0c0;line-height:1.6;margin:0 0 24px">
            Your submission for <strong style="color:#f0f0f0">${assignmentTitle || updated.assignment_id}</strong> has been graded.
          </p>
          <div style="background:#1c1c1e;border:1px solid #2a2a2a;border-radius:10px;padding:20px 24px;margin-bottom:24px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:${feedback ? '16px' : '0'}">
              <span style="font-size:13px;color:#8e8e93">Score</span>
              <span style="font-size:20px;font-weight:800;color:${pct >= 90 ? '#4ade80' : pct >= 70 ? '#fbbf24' : '#f87171'}">${grade}${assignmentPoints ? ` / ${assignmentPoints}` : ''} pts${pct != null ? ` · ${pct}% · ${letterGrade}` : ''}</span>
            </div>
            ${feedback ? `<div style="border-top:1px solid #2a2a2a;padding-top:14px"><div style="font-size:11px;font-weight:700;color:#4ade80;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:6px">Instructor Feedback</div><div style="font-size:13px;color:#c0c0c0;line-height:1.6">${feedback}</div></div>` : ''}
          </div>
          <p style="font-size:12px;color:#555;margin:0">Log in to Basis to view all your grades and assignments.</p>
        </div>
      `,
    }).catch(err => console.warn('Grade email failed:', err.message));
  }

  res.json({ submission: updated });
});

// DELETE /professor/students/:code/:userId — remove a student from a course
router.delete('/students/:code/:userId', requireAuth, requireProfessor, (req, res) => {
  const code   = req.params.code.toUpperCase();
  const userId = parseInt(req.params.userId);

  db.prepare('DELETE FROM enrollments WHERE user_id = ? AND course_code = ?').run(userId, code);

  // Revert to 'user' role if they have no remaining enrollments
  const remaining = db.prepare('SELECT COUNT(*) AS n FROM enrollments WHERE user_id = ?').get(userId).n;
  if (remaining === 0) {
    db.prepare("UPDATE users SET role = 'user' WHERE id = ? AND role = 'student'").run(userId);
  }

  res.json({ ok: true });
});

// PATCH /professor/codes/:code/toggle — activate or deactivate a code
router.patch('/codes/:code/toggle', requireAuth, requireProfessor, (req, res) => {
  const code = req.params.code.toUpperCase();
  const row = db.prepare('SELECT * FROM course_codes WHERE code = ?').get(code);
  if (!row) return res.status(404).json({ error: 'Code not found' });
  db.prepare('UPDATE course_codes SET active = ? WHERE code = ?').run(row.active ? 0 : 1, code);
  const updated = db.prepare('SELECT * FROM course_codes WHERE code = ?').get(code);
  res.json({ code: updated });
});

module.exports = router;
