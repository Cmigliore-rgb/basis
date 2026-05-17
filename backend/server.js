require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });

const Sentry = require('@sentry/node');
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  enabled: !!process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
});

const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
  standardHeaders: true, legacyHeaders: false,
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 8,
  message: { error: 'Too many registration attempts. Try again later.' },
  standardHeaders: true, legacyHeaders: false,
});

const strictLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Too many requests. Try again later.' },
  standardHeaders: true, legacyHeaders: false,
});

const authRoutes = require('./routes/auth');
const plaidRoutes = require('./routes/plaid');
const transactionRoutes = require('./routes/transactions');
const investmentRoutes = require('./routes/investments');
const newsRoutes = require('./routes/news');
const chatRoutes = require('./routes/chat');
const snapshotRoutes = require('./routes/snapshots');
const budgetRoutes = require('./routes/budget');
const goalsRoutes = require('./routes/goals');
const marketRoutes = require('./routes/market');
const optionsRoutes = require('./routes/options');
const professorRoutes = require('./routes/professor');
const submissionsRoutes = require('./routes/submissions');
const assignmentsRoutes = require('./routes/assignments');
const notificationsRoutes = require('./routes/notifications');
const feedbackRoutes = require('./routes/feedback');
const baselineRoutes = require('./routes/baseline');
const stripeRoutes   = require('./routes/stripe');
const store = require('./store');

const app = express();
app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: false,       // inline styles throughout the app
  crossOriginEmbedderPolicy: false,   // Plaid Link iframe
}));

app.use((req, res, next) => {
  if (req.headers['x-forwarded-proto'] === 'http') {
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  }
  next();
});

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || origin.includes('localhost') || origin.includes('172.20.142.211') || origin.includes('ngrok-free') || origin.includes('ngrok.io') || origin.includes('railway.app') || origin.includes('peakledger.app')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

// Stripe webhook must be registered before express.json() — needs raw body
app.use('/api/stripe', stripeRoutes);
// Plaid webhook verification also needs raw body — must be before express.json()
app.use('/api/plaid/webhook', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '2mb' }));

const saved = store.load();
app.locals.accessTokens      = saved.accessTokens;
app.locals.tellerTokens      = saved.tellerTokens;
app.locals.snapshots         = saved.snapshots         || [];
app.locals.budgetLimits      = saved.budgetLimits      || {};
app.locals.goals             = saved.goals             || [];
app.locals.notificationPrefs = saved.notificationPrefs || {};
app.locals.feedback          = saved.feedback          || [];

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth/login',               loginLimiter);
app.use('/api/auth/register',            registerLimiter);
app.use('/api/auth/forgot-password',     strictLimiter);
app.use('/api/auth/reset-password',      strictLimiter);
app.use('/api/auth/verify-2fa',          strictLimiter);
app.use('/api/auth/validate-code',       loginLimiter);
app.use('/api/auth/resend-verification', strictLimiter);
app.use('/api/feedback',                 strictLimiter);
app.use('/api/auth', authRoutes);

app.use('/api/plaid', plaidRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/investments', investmentRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/snapshots', snapshotRoutes);
app.use('/api/budget', budgetRoutes);
app.use('/api/goals', goalsRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/options', optionsRoutes);
app.use('/api/professor', professorRoutes);
app.use('/api/submissions', submissionsRoutes);
app.use('/api/assignments', assignmentsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/baseline', baselineRoutes);

Sentry.setupExpressErrorHandler(app);

if (process.env.NODE_ENV === 'production') {
  const frontendPath = path.join(__dirname, 'public');
  app.use(express.static(frontendPath));
  app.get('*', (req, res) => res.sendFile(path.join(frontendPath, 'index.html')));
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Ledger backend running on port ${PORT}`);
  // Seed test account on every boot so it exists in production
  try {
    const bcrypt = require('bcryptjs');
    const db = require('./db');
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get('test@peakledger.app');
    const hash = bcrypt.hashSync('Ledger123', 10);
    if (existing) {
      db.prepare('UPDATE users SET password_hash = ?, role = ?, tier = ?, email_verified = 1 WHERE email = ?')
        .run(hash, 'free', 'free', 'test@peakledger.app');
    } else {
      db.prepare('INSERT INTO users (email, password_hash, name, role, tier, email_verified) VALUES (?, ?, ?, ?, ?, 1)')
        .run('test@peakledger.app', hash, 'Test User', 'free', 'free');
    }
    console.log('[seed] test@peakledger.app ready');
  } catch (e) {
    console.warn('[seed] test account error:', e.message);
  }
});
