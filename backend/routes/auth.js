const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../db');
const requireAuth = require('../middleware/requireAuth');
const { send: sendEmail, isConfigured: emailConfigured } = require('../email');

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').toLowerCase().split(',').map(e => e.trim()).filter(Boolean);

function inferRole(email) {
  if (ADMIN_EMAILS.includes(email.toLowerCase())) return 'admin';
  return 'user';
}

const sign = (user) => jwt.sign(
  { id: user.id, email: user.email, role: user.role, tier: user.tier },
  process.env.JWT_SECRET,
  { expiresIn: '30d' }
);

const getEnrollments = (userId) =>
  db.prepare(`
    SELECT c.code, c.course_id, c.course_name, c.instructor_name, c.semester
    FROM enrollments e JOIN course_codes c ON e.course_code = c.code
    WHERE e.user_id = ? ORDER BY e.enrolled_at ASC
  `).all(userId);

const safeUser = (u, enrollments = []) => ({
  id: u.id, email: u.email, name: u.name, role: u.role, tier: u.tier,
  email_verified: !!u.email_verified, created_at: u.created_at, enrollments,
});

const APP_URL = process.env.FRONTEND_URL || 'https://peakledger.app';

// Validate a course code (public — no auth required)
router.post('/validate-code', (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'code is required' });
  const row = db.prepare('SELECT * FROM course_codes WHERE code = ? AND active = 1').get(code.toUpperCase().trim());
  if (!row) return res.status(404).json({ error: 'Course code not found' });
  res.json({ course: { code: row.code, course_id: row.course_id, course_name: row.course_name, instructor_name: row.instructor_name, semester: row.semester } });
});

router.post('/register', async (req, res) => {
  const { email, password, name, role: requestedRole, courseCode } = req.body;
  if (!email || !password || !name) return res.status(400).json({ error: 'email, password, and name are required' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  // Validate course code before doing anything else
  let courseRow = null;
  if (courseCode) {
    courseRow = db.prepare('SELECT * FROM course_codes WHERE code = ? AND active = 1').get(courseCode.toUpperCase().trim());
    if (!courseRow) return res.status(400).json({ error: 'Invalid or expired course code' });
  }

  let role = inferRole(email);
  if (requestedRole === 'professor' && role === 'user') role = 'professor';
  // A valid course code elevates to student role regardless of email domain
  if (courseRow && role === 'user') role = 'student';

  const tier = (role === 'admin' || role === 'professor') ? 'premium' : 'free';
  const autoVerified = (role === 'admin' || role === 'professor') ? 1 : 0;
  const verificationToken = autoVerified ? null : crypto.randomBytes(32).toString('hex');
  const password_hash = await bcrypt.hash(password, 12);

  try {
    const result = db.prepare(
      'INSERT INTO users (email, password_hash, name, role, tier, email_verified, verification_token) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(email.toLowerCase(), password_hash, name, role, tier, autoVerified, verificationToken);

    const userId = result.lastInsertRowid;

    if (courseRow) {
      db.prepare('INSERT OR IGNORE INTO enrollments (user_id, course_code) VALUES (?, ?)').run(userId, courseRow.code);
    }

    // Send verification email (non-blocking)
    if (verificationToken && emailConfigured()) {
      const verifyUrl = `${APP_URL}/api/auth/verify-email?token=${verificationToken}`;
      sendEmail({
        to: email.toLowerCase(),
        subject: 'Verify your PeakLedger email',
        html: `
          <div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0f172a;border-radius:12px;">
            <div style="font-size:22px;font-weight:700;color:#f1f5f9;margin-bottom:8px;">Verify your email</div>
            <div style="font-size:14px;color:#94a3b8;margin-bottom:28px;line-height:1.6;">
              Hi ${name}, click the button below to verify your email and unlock your student discount if you registered with a .edu address.
            </div>
            <a href="${verifyUrl}" style="display:inline-block;padding:12px 28px;background:#0066f5;color:#fff;border-radius:8px;font-size:15px;font-weight:700;text-decoration:none;">
              Verify Email
            </a>
            <div style="margin-top:24px;font-size:12px;color:#475569;">
              Or copy this link: ${verifyUrl}
            </div>
          </div>
        `,
      }).catch(err => console.error('Verification email failed:', err.message));
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    const enrollments = getEnrollments(userId);
    res.status(201).json({ token: sign(user), user: safeUser(user, enrollments) });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'An account with that email already exists' });
    console.error('Register error:', err.message);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (!user) return res.status(401).json({ error: 'Invalid email or password' });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

  const enrollments = getEnrollments(user.id);
  res.json({ token: sign(user), user: safeUser(user, enrollments) });
});

router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT id, email, name, role, tier, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const enrollments = getEnrollments(user.id);
  res.json({ user: safeUser(user, enrollments) });
});

// Email verification
router.get('/verify-email', (req, res) => {
  const { token } = req.query;
  if (!token) return res.redirect(`${APP_URL}/app?verify_error=1`);
  const user = db.prepare('SELECT * FROM users WHERE verification_token = ?').get(token);
  if (!user) return res.redirect(`${APP_URL}/app?verify_error=1`);
  db.prepare('UPDATE users SET email_verified = 1, verification_token = NULL WHERE id = ?').run(user.id);
  res.redirect(`${APP_URL}/app?verified=1`);
});

// Resend verification email
router.post('/resend-verification', requireAuth, async (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.email_verified) return res.status(400).json({ error: 'Email already verified' });
  if (!emailConfigured()) return res.status(500).json({ error: 'Email not configured' });

  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('UPDATE users SET verification_token = ? WHERE id = ?').run(token, user.id);

  const verifyUrl = `${APP_URL}/api/auth/verify-email?token=${token}`;
  try {
    await sendEmail({
      to: user.email,
      subject: 'Verify your PeakLedger email',
      html: `
        <div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0f172a;border-radius:12px;">
          <div style="font-size:22px;font-weight:700;color:#f1f5f9;margin-bottom:8px;">Verify your email</div>
          <div style="font-size:14px;color:#94a3b8;margin-bottom:28px;line-height:1.6;">
            Click the button below to verify your email and unlock your student discount.
          </div>
          <a href="${verifyUrl}" style="display:inline-block;padding:12px 28px;background:#0066f5;color:#fff;border-radius:8px;font-size:15px;font-weight:700;text-decoration:none;">
            Verify Email
          </a>
          <div style="margin-top:24px;font-size:12px;color:#475569;">Or copy this link: ${verifyUrl}</div>
        </div>
      `,
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send email' });
  }
});

// Enroll authenticated user in a course by code
router.post('/enroll', requireAuth, (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'code is required' });
  const courseRow = db.prepare('SELECT * FROM course_codes WHERE code = ? AND active = 1').get(code.toUpperCase().trim());
  if (!courseRow) return res.status(404).json({ error: 'Course code not found' });

  db.prepare('INSERT OR IGNORE INTO enrollments (user_id, course_code) VALUES (?, ?)').run(req.user.id, courseRow.code);
  if (req.user.role === 'user') {
    db.prepare('UPDATE users SET role = ? WHERE id = ?').run('student', req.user.id);
  }
  const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const enrollments = getEnrollments(req.user.id);
  res.json({ token: sign(updatedUser), user: safeUser(updatedUser, enrollments), enrollments });
});

// Admin: list all users
router.get('/users', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const users = db.prepare('SELECT id, email, name, role, tier, created_at FROM users WHERE is_demo = 0 OR is_demo IS NULL ORDER BY created_at DESC').all();
  res.json({ users });
});

// Admin: update a user's role or tier
router.patch('/users/:id', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const { role, tier } = req.body;
  const allowed_roles = ['admin', 'professor', 'student', 'user'];
  const allowed_tiers = ['free', 'premium'];
  if (role && !allowed_roles.includes(role)) return res.status(400).json({ error: 'Invalid role' });
  if (tier && !allowed_tiers.includes(tier)) return res.status(400).json({ error: 'Invalid tier' });

  const updates = [];
  const params = [];
  if (role) { updates.push('role = ?'); params.push(role); }
  if (tier) { updates.push('tier = ?'); params.push(tier); }
  if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });

  params.push(parseInt(req.params.id));
  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  const user = db.prepare('SELECT id, email, name, role, tier, created_at FROM users WHERE id = ?').get(parseInt(req.params.id));
  res.json({ user: safeUser(user) });
});

module.exports = router;
