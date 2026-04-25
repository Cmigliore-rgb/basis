const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

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
const store = require('./store');

const app = express();

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || origin.includes('localhost') || origin.includes('ngrok-free') || origin.includes('ngrok.io')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

app.use(express.json({ limit: '2mb' }));

const saved = store.load();
app.locals.accessTokens = saved.accessTokens;
app.locals.tellerTokens = saved.tellerTokens;
app.locals.snapshots    = saved.snapshots    || [];
app.locals.budgetLimits = saved.budgetLimits || {};
app.locals.goals        = saved.goals        || [];

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Ledger backend running on port ${PORT}`));
