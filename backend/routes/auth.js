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
  backup_email: u.backup_email || null,
  two_factor_enabled: !!u.two_factor_enabled,
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
  if (!/[^A-Za-z0-9]/.test(password)) return res.status(400).json({ error: 'Password must contain at least one special character' });

  // Validate course code before doing anything else
  let courseRow = null;
  if (courseCode) {
    courseRow = db.prepare('SELECT * FROM course_codes WHERE code = ? AND active = 1').get(courseCode.toUpperCase().trim());
    if (!courseRow) return res.status(400).json({ error: 'Invalid or expired course code' });
  }

  let role = inferRole(email);
  if (requestedRole === 'professor' && role === 'user') {
    const dbRow = db.prepare("SELECT value FROM app_settings WHERE key = 'professor_invite_code'").get();
    const validCode = dbRow?.value || process.env.PROFESSOR_INVITE_CODE;
    if (!validCode || req.body.professorCode !== validCode) {
      return res.status(400).json({ error: 'Invalid professor access code' });
    }
    role = 'professor';
  }
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

  const user = db.prepare('SELECT * FROM users WHERE email = ? OR (backup_email IS NOT NULL AND backup_email = ?)').get(email.toLowerCase(), email.toLowerCase());
  if (!user) return res.status(401).json({ error: 'Invalid email or password' });

  const valid = await bcrypt.compare(password, user.password_hash || '');
  if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

  if (user.two_factor_enabled) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = await bcrypt.hash(code, 10);
    const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const tempToken = crypto.randomBytes(32).toString('hex');
    db.prepare('UPDATE users SET two_factor_code = ?, two_factor_expires_at = ?, two_factor_temp_token = ? WHERE id = ?')
      .run(codeHash, expires, tempToken, user.id);
    sendEmail({
      to: user.email,
      subject: 'Your PeakLedger login code',
      html: `
        <div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0f172a;border-radius:12px;">
          <div style="font-size:22px;font-weight:700;color:#f1f5f9;margin-bottom:8px;">Your login code</div>
          <div style="font-size:14px;color:#94a3b8;margin-bottom:28px;line-height:1.6;">
            Hi ${user.name}, use the code below to complete your sign-in. It expires in 10 minutes.
          </div>
          <div style="font-size:40px;font-weight:800;letter-spacing:10px;color:#f1f5f9;background:#1e293b;padding:20px 28px;border-radius:10px;text-align:center;margin-bottom:24px;">
            ${code}
          </div>
          <div style="font-size:12px;color:#475569;">If you didn't try to sign in, you can safely ignore this email.</div>
        </div>
      `,
    }).catch(err => console.error('2FA email failed:', err.message));
    return res.json({ requiresTwoFactor: true, tempToken });
  }

  const enrollments = getEnrollments(user.id);
  res.json({ token: sign(user), user: safeUser(user, enrollments) });
});

// ── 2FA: verify code ──────────────────────────────────────────────────────────
router.post('/verify-2fa', async (req, res) => {
  const { tempToken, code } = req.body;
  if (!tempToken || !code) return res.status(400).json({ error: 'tempToken and code are required' });

  const user = db.prepare('SELECT * FROM users WHERE two_factor_temp_token = ?').get(tempToken);
  if (!user) return res.status(401).json({ error: 'Invalid or expired session' });
  if (!user.two_factor_expires_at || new Date(user.two_factor_expires_at) < new Date())
    return res.status(401).json({ error: 'Code expired. Please sign in again.' });

  const valid = await bcrypt.compare(code.trim(), user.two_factor_code || '');
  if (!valid) return res.status(401).json({ error: 'Incorrect code' });

  db.prepare('UPDATE users SET two_factor_code = NULL, two_factor_expires_at = NULL, two_factor_temp_token = NULL WHERE id = ?').run(user.id);
  const enrollments = getEnrollments(user.id);
  res.json({ token: sign(user), user: safeUser(user, enrollments) });
});

// ── 2FA: enable / disable ─────────────────────────────────────────────────────
router.post('/2fa/enable', requireAuth, (req, res) => {
  db.prepare('UPDATE users SET two_factor_enabled = 1 WHERE id = ?').run(req.user.id);
  res.json({ ok: true });
});

router.post('/2fa/disable', requireAuth, (req, res) => {
  db.prepare('UPDATE users SET two_factor_enabled = 0, two_factor_code = NULL, two_factor_expires_at = NULL, two_factor_temp_token = NULL WHERE id = ?').run(req.user.id);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT id, email, name, role, tier, email_verified, backup_email, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const enrollments = getEnrollments(user.id);
  res.json({ user: safeUser(user, enrollments) });
});

// Forgot password — send reset email
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email is required' });
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  // Always respond 200 to avoid email enumeration
  if (!user || !emailConfigured()) return res.json({ ok: true });

  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour
  db.prepare('UPDATE users SET reset_token = ?, reset_token_expires_at = ? WHERE id = ?').run(token, expires, user.id);

  const resetUrl = `${APP_URL}/reset-password?token=${token}`;
  sendEmail({
    to: user.email,
    subject: 'Reset your PeakLedger password',
    html: `
      <div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0f172a;border-radius:12px;">
        <div style="font-size:22px;font-weight:700;color:#f1f5f9;margin-bottom:8px;">Reset your password</div>
        <div style="font-size:14px;color:#94a3b8;margin-bottom:28px;line-height:1.6;">
          Hi ${user.name}, click the button below to reset your password. This link expires in 1 hour.
        </div>
        <a href="${resetUrl}" style="display:inline-block;padding:12px 28px;background:#0066f5;color:#fff;border-radius:8px;font-size:15px;font-weight:700;text-decoration:none;">
          Reset Password
        </a>
        <div style="margin-top:24px;font-size:12px;color:#475569;">
          If you didn't request this, you can safely ignore this email.
        </div>
      </div>
    `,
  }).catch(err => console.error('Reset email failed:', err.message));

  res.json({ ok: true });
});

// Reset password — validate token and set new password
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'token and password are required' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  const user = db.prepare('SELECT * FROM users WHERE reset_token = ?').get(token);
  if (!user || !user.reset_token_expires_at) return res.status(400).json({ error: 'Invalid or expired reset link' });
  if (new Date(user.reset_token_expires_at) < new Date()) return res.status(400).json({ error: 'Reset link has expired. Please request a new one.' });

  const password_hash = await bcrypt.hash(password, 12);
  db.prepare('UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires_at = NULL WHERE id = ?').run(password_hash, user.id);

  res.json({ ok: true });
});

// Update own profile (backup email)
router.patch('/me', requireAuth, (req, res) => {
  try {
    const { backup_email } = req.body;
    if (backup_email !== undefined) {
      if (backup_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(backup_email)) {
        return res.status(400).json({ error: 'Invalid email address' });
      }
      if (backup_email && backup_email.toLowerCase() === (req.user.email || '').toLowerCase()) {
        return res.status(400).json({ error: 'Backup email must be different from your primary email' });
      }
      db.prepare('UPDATE users SET backup_email = ? WHERE id = ?').run(backup_email || null, req.user.id);
    }
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const enrollments = getEnrollments(req.user.id);
    res.json({ user: safeUser(user, enrollments) });
  } catch (err) {
    console.error('[PATCH /me]', err.message);
    res.status(500).json({ error: 'Failed to save changes' });
  }
});

// Email verification
router.get('/verify-email', (req, res) => {
  const { token } = req.query;
  if (!token) return res.redirect(`${APP_URL}/login?verify_error=1`);
  const user = db.prepare('SELECT * FROM users WHERE verification_token = ?').get(token);
  if (!user) return res.redirect(`${APP_URL}/login?verify_error=1`);
  const isEdu = user.email.toLowerCase().endsWith('.edu');
  if (isEdu && user.role === 'user') {
    db.prepare("UPDATE users SET email_verified = 1, verification_token = NULL, role = 'student', edu_verified_at = datetime('now') WHERE id = ?").run(user.id);
  } else if (isEdu) {
    db.prepare("UPDATE users SET email_verified = 1, verification_token = NULL, edu_verified_at = datetime('now'), reverification_sent_at = NULL WHERE id = ?").run(user.id);
  } else {
    db.prepare('UPDATE users SET email_verified = 1, verification_token = NULL WHERE id = ?').run(user.id);
  }
  res.redirect(`${APP_URL}/login?verified=1`);
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

// Delete own account — removes all Plaid items, cancels Stripe, purges all user data
router.delete('/me', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const { plaidClient } = require('../routes/plaid');

  const userRow = db.prepare('SELECT stripe_subscription_id, stripe_customer_id FROM users WHERE id = ?').get(userId);

  // Cancel Stripe subscription and delete customer (best-effort)
  if (process.env.STRIPE_SECRET_KEY) {
    try {
      const Stripe = require('stripe');
      const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
      if (userRow?.stripe_subscription_id) {
        await stripe.subscriptions.cancel(userRow.stripe_subscription_id).catch(() => {});
      }
      if (userRow?.stripe_customer_id) {
        await stripe.customers.del(userRow.stripe_customer_id).catch(() => {});
      }
    } catch {}
  }

  // Remove all Plaid items (best-effort)
  const tokens = db.prepare('SELECT access_token FROM plaid_tokens WHERE user_id = ?').all(userId);
  await Promise.allSettled(
    tokens.map(({ access_token }) => plaidClient.itemRemove({ access_token }))
  );

  // Purge all user data from SQLite
  db.prepare('DELETE FROM plaid_tokens          WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM manual_liabilities    WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM baselines             WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM monthly_actuals       WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM enrollments           WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM submissions           WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM notifications         WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM net_worth_snapshots   WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM users                 WHERE id = ?').run(userId);

  res.json({ success: true });
});

// Admin: list all users
router.get('/users', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const users = db.prepare('SELECT id, email, name, role, tier, email_verified, created_at FROM users WHERE is_demo = 0 OR is_demo IS NULL ORDER BY created_at DESC').all();
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

// Admin: delete a user and their data
router.delete('/users/:id', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const id = parseInt(req.params.id);
  const target = db.prepare('SELECT id, role FROM users WHERE id = ?').get(id);
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.role === 'admin') return res.status(400).json({ error: 'Cannot delete admin accounts' });
  db.prepare('DELETE FROM enrollments WHERE user_id = ?').run(id);
  db.prepare('DELETE FROM submissions WHERE user_id = ?').run(id);
  db.prepare('DELETE FROM notifications WHERE user_id = ?').run(id);
  db.prepare('DELETE FROM plaid_tokens WHERE user_id = ?').run(id);
  db.prepare('DELETE FROM baselines WHERE user_id = ?').run(id);
  db.prepare('DELETE FROM monthly_actuals WHERE user_id = ?').run(id);
  db.prepare('DELETE FROM goals WHERE user_id = ?').run(id);
  try { db.prepare('DELETE FROM transactions_cache WHERE user_id = ?').run(id); } catch {}
  try { db.prepare('DELETE FROM accounts_cache WHERE user_id = ?').run(id); } catch {}
  try { db.prepare('DELETE FROM holdings_cache WHERE user_id = ?').run(id); } catch {}
  try { db.prepare('DELETE FROM liabilities_cache WHERE user_id = ?').run(id); } catch {}
  try { db.prepare('DELETE FROM net_worth_snapshots WHERE user_id = ?').run(id); } catch {}
  try { db.prepare('DELETE FROM budget_limits WHERE user_id = ?').run(id); } catch {}
  try { db.prepare('DELETE FROM manual_liabilities WHERE user_id = ?').run(id); } catch {}
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  res.json({ ok: true });
});

// Admin: send annual re-verification emails to students with expired .edu verification
router.post('/admin/edu-reverify', requireAuth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  if (!emailConfigured()) return res.status(500).json({ error: 'Email not configured' });

  const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);
  const students = db.prepare(`
    SELECT * FROM users WHERE role = 'student' AND email LIKE '%.edu' AND is_demo = 0
    AND (edu_verified_at IS NULL OR edu_verified_at < ?)
    AND (reverification_sent_at IS NULL OR reverification_sent_at < ?)
  `).all(oneYearAgo, oneYearAgo);

  let sent = 0, failed = 0;
  for (const student of students) {
    try {
      const token = crypto.randomBytes(32).toString('hex');
      db.prepare("UPDATE users SET verification_token = ?, reverification_sent_at = datetime('now') WHERE id = ?").run(token, student.id);
      const verifyUrl = `${APP_URL}/api/auth/verify-email?token=${token}`;
      await sendEmail({
        to: student.email,
        subject: 'Re-verify your student status — PeakLedger',
        html: `
          <div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0f172a;border-radius:12px;">
            <div style="font-size:22px;font-weight:700;color:#f1f5f9;margin-bottom:8px;">Re-verify your student status</div>
            <div style="font-size:14px;color:#94a3b8;margin-bottom:28px;line-height:1.6;">
              Your annual student discount verification is due. Click below to confirm your .edu email and keep your student pricing for another year.
            </div>
            <a href="${verifyUrl}" style="display:inline-block;padding:12px 28px;background:#0066f5;color:#fff;border-radius:8px;font-size:15px;font-weight:700;text-decoration:none;">
              Re-verify Student Status
            </a>
            <div style="margin-top:24px;font-size:12px;color:#475569;">If you don't verify within 30 days, your account will revert to standard pricing. Or copy this link: ${verifyUrl}</div>
          </div>
        `,
      });
      sent++;
    } catch { failed++; }
  }
  res.json({ total: students.length, sent, failed });
});

// Admin: expire students who didn't re-verify within 30 days and update their Stripe price
router.post('/admin/edu-expire', requireAuth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);
  const oneYearAgo   = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);

  const expired = db.prepare(`
    SELECT * FROM users WHERE role = 'student' AND email LIKE '%.edu' AND is_demo = 0
    AND reverification_sent_at < ?
    AND (edu_verified_at IS NULL OR edu_verified_at < ?)
  `).all(thirtyDaysAgo, oneYearAgo);

  const PRICE_STANDARD = process.env.STRIPE_PRICE_STANDARD;
  let reverted = 0, stripeUpdated = 0;
  const errors = [];

  for (const u of expired) {
    db.prepare("UPDATE users SET role = 'user' WHERE id = ?").run(u.id);
    reverted++;

    if (u.stripe_subscription_id && PRICE_STANDARD) {
      try {
        const Stripe = require('stripe');
        const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
        const sub = await stripe.subscriptions.retrieve(u.stripe_subscription_id);
        const itemId = sub.items.data[0]?.id;
        if (itemId) {
          await stripe.subscriptions.update(u.stripe_subscription_id, {
            items: [{ id: itemId, price: PRICE_STANDARD }],
            proration_behavior: 'none',
          });
          stripeUpdated++;
        }
      } catch (err) {
        errors.push({ userId: u.id, email: u.email, error: err.message });
      }
    }
  }

  res.json({ total: expired.length, reverted, stripeUpdated, errors });
});

// ── OAuth: Google ─────────────────────────────────────────────────────────────
const { createRemoteJWKSet, jwtVerify } = require('jose');

const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const APPLE_JWKS  = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));
const MS_JWKS     = createRemoteJWKSet(new URL('https://login.microsoftonline.com/common/discovery/v2.0/keys'));

router.post('/google', async (req, res) => {
  const { credential } = req.body;
  if (!credential) return res.status(400).json({ error: 'credential required' });
  if (!process.env.GOOGLE_CLIENT_ID) return res.status(503).json({ error: 'Google Sign-In not configured' });

  try {
    const { payload } = await jwtVerify(credential, GOOGLE_JWKS, {
      audience: process.env.GOOGLE_CLIENT_ID,
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
    });

    const { sub: googleId, email, name } = payload;
    if (!email) return res.status(400).json({ error: 'No email in Google token' });

    let user = db.prepare('SELECT * FROM users WHERE google_id = ?').get(googleId);
    if (!user) user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());

    if (user) {
      if (!user.google_id) {
        db.prepare('UPDATE users SET google_id = ?, email_verified = 1 WHERE id = ?').run(googleId, user.id);
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
      }
    } else {
      const role = inferRole(email);
      const tier = (role === 'admin' || role === 'professor') ? 'premium' : 'free';
      const result = db.prepare(
        'INSERT INTO users (email, password_hash, name, role, tier, email_verified, google_id) VALUES (?, ?, ?, ?, ?, 1, ?)'
      ).run(email.toLowerCase(), '', name || email.split('@')[0], role, tier, googleId);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    }

    const enrollments = getEnrollments(user.id);
    res.json({ token: sign(user), user: safeUser(user, enrollments) });
  } catch (err) {
    console.error('Google auth error:', err.message);
    res.status(401).json({ error: 'Invalid Google credential' });
  }
});

// ── OAuth: Apple ─────────────────────────────────────────────────────────────
router.post('/apple', async (req, res) => {
  const { id_token, name } = req.body;
  if (!id_token) return res.status(400).json({ error: 'id_token required' });
  if (!process.env.APPLE_CLIENT_ID) return res.status(503).json({ error: 'Apple Sign-In not configured' });

  try {
    const { payload } = await jwtVerify(id_token, APPLE_JWKS, {
      audience: process.env.APPLE_CLIENT_ID,
      issuer: 'https://appleid.apple.com',
    });

    const { sub: appleId, email } = payload;
    if (!appleId) return res.status(400).json({ error: 'No subject in Apple token' });

    let user = db.prepare('SELECT * FROM users WHERE apple_id = ?').get(appleId);
    if (!user && email) user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());

    if (user) {
      if (!user.apple_id) {
        db.prepare('UPDATE users SET apple_id = ?, email_verified = 1 WHERE id = ?').run(appleId, user.id);
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
      }
    } else {
      const userEmail = email ? email.toLowerCase() : `${appleId}@privaterelay.appleid.com`;
      const userName  = name || (email ? email.split('@')[0] : 'Apple User');
      const role = email ? inferRole(email) : 'user';
      const tier = (role === 'admin' || role === 'professor') ? 'premium' : 'free';
      const result = db.prepare(
        'INSERT INTO users (email, password_hash, name, role, tier, email_verified, apple_id) VALUES (?, ?, ?, ?, ?, 1, ?)'
      ).run(userEmail, '', userName, role, tier, appleId);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    }

    const enrollments = getEnrollments(user.id);
    res.json({ token: sign(user), user: safeUser(user, enrollments) });
  } catch (err) {
    console.error('Apple auth error:', err.message);
    res.status(401).json({ error: 'Invalid Apple token' });
  }
});

// ── OAuth: Microsoft ─────────────────────────────────────────────────────────
router.post('/microsoft', async (req, res) => {
  const { id_token } = req.body;
  if (!id_token) return res.status(400).json({ error: 'id_token required' });
  if (!process.env.MICROSOFT_CLIENT_ID) return res.status(503).json({ error: 'Microsoft Sign-In not configured' });

  try {
    const { payload } = await jwtVerify(id_token, MS_JWKS, {
      audience: process.env.MICROSOFT_CLIENT_ID,
    });

    // Multi-tenant: issuer contains the specific tenant ID
    if (!payload.iss?.match(/^https:\/\/login\.microsoftonline\.com\/[^/]+\/v2\.0$/)) {
      return res.status(401).json({ error: 'Invalid token issuer' });
    }

    const { oid: msId, email, preferred_username, name } = payload;
    if (!msId) return res.status(400).json({ error: 'No identifier in Microsoft token' });
    const userEmail = (email || preferred_username || '').toLowerCase();

    let user = db.prepare('SELECT * FROM users WHERE microsoft_id = ?').get(msId);
    if (!user && userEmail) user = db.prepare('SELECT * FROM users WHERE email = ?').get(userEmail);

    if (user) {
      if (!user.microsoft_id) {
        db.prepare('UPDATE users SET microsoft_id = ?, email_verified = 1 WHERE id = ?').run(msId, user.id);
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
      }
    } else {
      const finalEmail = userEmail || `${msId}@microsoft-oauth.local`;
      const role = userEmail ? inferRole(userEmail) : 'user';
      const tier = (role === 'admin' || role === 'professor') ? 'premium' : 'free';
      const result = db.prepare(
        'INSERT INTO users (email, password_hash, name, role, tier, email_verified, microsoft_id) VALUES (?, ?, ?, ?, ?, 1, ?)'
      ).run(finalEmail, '', name || finalEmail.split('@')[0], role, tier, msId);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    }

    const enrollments = getEnrollments(user.id);
    res.json({ token: sign(user), user: safeUser(user, enrollments) });
  } catch (err) {
    console.error('Microsoft auth error:', err.message);
    res.status(401).json({ error: 'Invalid Microsoft token' });
  }
});

// ── Professor access code management (admin only) ─────────────────────────

function getProfessorCode() {
  const row = db.prepare("SELECT value FROM app_settings WHERE key = 'professor_invite_code'").get();
  return row?.value || process.env.PROFESSOR_INVITE_CODE || null;
}

router.get('/admin/professor-code', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const code = getProfessorCode();
  res.json({ code });
});

router.post('/admin/professor-code', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const code = req.body.code?.trim().toUpperCase();
  if (!code || code.length < 4) return res.status(400).json({ error: 'Code must be at least 4 characters' });
  db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('professor_invite_code', ?)").run(code);
  res.json({ code });
});

router.post('/admin/professor-code/regenerate', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const code = 'PROF-' + crypto.randomBytes(3).toString('hex').toUpperCase();
  db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('professor_invite_code', ?)").run(code);
  res.json({ code });
});

module.exports = router;
