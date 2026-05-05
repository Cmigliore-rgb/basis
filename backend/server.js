const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const authRoutes = require('./routes/auth');
const plaidRoutes = require('./routes/plaid');
const transactionRoutes = require('./routes/transactions');
const investmentRoutes = require('./routes/investments');
const newsRoutes = require('./routes/news');
const tellerRoutes = require('./routes/teller');
const chatRoutes = require('./routes/chat');
const snapshotRoutes = require('./routes/snapshots');
const budgetRoutes = require('./routes/budget');
const goalsRoutes = require('./routes/goals');
const marketRoutes = require('./routes/market');
const optionsRoutes = require('./routes/options');
const professorRoutes = require('./routes/professor');
const submissionsRoutes = require('./routes/submissions');
const notificationsRoutes = require('./routes/notifications');
const feedbackRoutes = require('./routes/feedback');
const store = require('./store');

const app = express();

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || origin.includes('localhost') || origin.includes('172.20.142.211')||origin.includes('ngrok-free') || origin.includes('ngrok.io')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

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
app.use('/api/auth', authRoutes);

app.use('/api/plaid', plaidRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/investments', investmentRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/teller', tellerRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/snapshots', snapshotRoutes);
app.use('/api/budget', budgetRoutes);
app.use('/api/goals', goalsRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/options', optionsRoutes);
app.use('/api/professor', professorRoutes);
app.use('/api/submissions', submissionsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/feedback', feedbackRoutes);

if (process.env.NODE_ENV === 'production') {
  const frontendPath = path.join(__dirname, 'public');
  app.use(express.static(frontendPath));
  app.get('*', (req, res) => res.sendFile(path.join(frontendPath, 'index.html')));
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Ledger backend running on port ${PORT}`));
