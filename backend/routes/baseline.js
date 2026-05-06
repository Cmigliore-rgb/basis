const express = require('express');
const router = express.Router();
const { plaidClient } = require('./plaid');
const requireAuth = require('../middleware/requireAuth');
const db = require('../db');

function getUserTokens(userId) {
  return db.prepare('SELECT access_token FROM plaid_tokens WHERE user_id = ?').all(userId);
}

async function fetchAllTransactions(access_token, start, end) {
  const transactions = [];
  let offset = 0;
  while (true) {
    const r = await plaidClient.transactionsGet({
      access_token, start_date: start, end_date: end,
      options: { count: 500, offset },
    });
    transactions.push(...r.data.transactions);
    if (transactions.length >= r.data.total_transactions) break;
    offset += r.data.transactions.length;
    if (r.data.transactions.length === 0) break;
  }
  return transactions;
}

function getQuarter(month) {
  return month <= 3 ? 'Q1' : month <= 6 ? 'Q2' : month <= 9 ? 'Q3' : 'Q4';
}

// POST /api/baseline/compute — fetch Plaid history and store baseline
router.post('/compute', requireAuth, async (req, res) => {
  const tokens = getUserTokens(req.user.id);
  if (!tokens.length) return res.status(400).json({ error: 'No accounts connected' });

  try {
    const end = new Date().toISOString().slice(0, 10);
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 13);
    const start = startDate.toISOString().slice(0, 10);

    const allTxns = (await Promise.all(
      tokens.map(({ access_token }) => fetchAllTransactions(access_token, start, end).catch(() => []))
    )).flat();

    // Group by month
    const monthly = {};
    allTxns.forEach(txn => {
      if (txn.pending) return;
      const key = txn.date.slice(0, 7);
      if (!monthly[key]) monthly[key] = { income: 0, spending: 0, categories: {} };
      const cat = txn.personal_finance_category?.primary || txn.category?.[0] || 'OTHER';
      if (txn.amount < 0) {
        monthly[key].income += Math.abs(txn.amount);
      } else {
        monthly[key].spending += txn.amount;
        monthly[key].categories[cat] = (monthly[key].categories[cat] || 0) + txn.amount;
      }
    });

    const keys = Object.keys(monthly).sort();
    if (keys.length < 1) return res.status(400).json({ error: 'Not enough transaction history' });

    // Exclude current partial month from baseline averages
    const nowKey = new Date().toISOString().slice(0, 7);
    const fullMonths = keys.filter(k => k !== nowKey);
    const baseKeys = fullMonths.length > 0 ? fullMonths : keys;

    const nets = baseKeys.map(k => monthly[k].income - monthly[k].spending);
    const avgIncome = baseKeys.reduce((s, k) => s + monthly[k].income, 0) / baseKeys.length;
    const avgSpending = baseKeys.reduce((s, k) => s + monthly[k].spending, 0) / baseKeys.length;
    const avgNet = nets.reduce((a, b) => a + b, 0) / nets.length;
    const netStddev = Math.sqrt(nets.reduce((s, n) => s + Math.pow(n - avgNet, 2), 0) / nets.length);

    // Category averages
    const catTotals = {}, catCounts = {};
    baseKeys.forEach(k => {
      Object.entries(monthly[k].categories).forEach(([cat, amt]) => {
        catTotals[cat] = (catTotals[cat] || 0) + amt;
        catCounts[cat] = (catCounts[cat] || 0) + 1;
      });
    });
    const categoryAverages = Object.fromEntries(
      Object.entries(catTotals).map(([cat, total]) => [cat, total / catCounts[cat]])
    );

    // Seasonal multipliers: how each quarter's spending compares to the annual average
    const qSpending = { Q1: [], Q2: [], Q3: [], Q4: [] };
    baseKeys.forEach(k => {
      const mo = parseInt(k.split('-')[1]);
      qSpending[getQuarter(mo)].push(monthly[k].spending);
    });
    const seasonalMultipliers = {};
    ['Q1', 'Q2', 'Q3', 'Q4'].forEach(q => {
      if (qSpending[q].length > 0) {
        const qAvg = qSpending[q].reduce((a, b) => a + b, 0) / qSpending[q].length;
        seasonalMultipliers[q] = avgSpending > 0 ? qAvg / avgSpending : 1.0;
      } else {
        // Fallback population defaults
        seasonalMultipliers[q] = q === 'Q4' ? 1.18 : q === 'Q1' ? 0.92 : 1.0;
      }
    });

    // Store baseline
    db.prepare(`
      INSERT OR REPLACE INTO baselines
        (user_id, avg_monthly_income, avg_monthly_spending, avg_monthly_net, net_stddev, category_averages, seasonal_multipliers, months_of_data, computed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(req.user.id, avgIncome, avgSpending, avgNet, netStddev,
           JSON.stringify(categoryAverages), JSON.stringify(seasonalMultipliers), baseKeys.length);

    // Store all monthly actuals (including current partial month)
    const insertMonth = db.prepare(`
      INSERT OR REPLACE INTO monthly_actuals (user_id, year, month, income, spending, net, category_totals)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    keys.forEach(key => {
      const [yr, mo] = key.split('-').map(Number);
      const d = monthly[key];
      insertMonth.run(req.user.id, yr, mo, d.income, d.spending, d.income - d.spending, JSON.stringify(d.categories));
    });

    res.json({ success: true, monthsOfData: baseKeys.length });
  } catch (err) {
    console.error('Baseline compute error:', err.message);
    res.status(500).json({ error: 'Failed to compute baseline' });
  }
});

// GET /api/baseline — return baseline + monthly history for the chart
router.get('/', requireAuth, (req, res) => {
  const bl = db.prepare('SELECT * FROM baselines WHERE user_id = ?').get(req.user.id);
  if (!bl) return res.json({ baseline: null, months: [], status: 'uncalibrated' });

  const sm = JSON.parse(bl.seasonal_multipliers || '{}');
  const band = Math.max(bl.net_stddev, bl.avg_monthly_spending * 0.08);

  // Last 12 completed months + current partial
  const rows = db.prepare(`
    SELECT year, month, income, spending, net, category_totals
    FROM monthly_actuals WHERE user_id = ?
    ORDER BY year DESC, month DESC LIMIT 13
  `).all(req.user.id).reverse();

  const months = rows.map(r => {
    const q = getQuarter(r.month);
    const multiplier = sm[q] || 1.0;
    const seasonalBaseline = bl.avg_monthly_income - bl.avg_monthly_spending * multiplier;
    return {
      label: `${r.year}-${String(r.month).padStart(2, '0')}`,
      income: r.income,
      spending: r.spending,
      net: r.net,
      baseline: seasonalBaseline,
      bandUpper: seasonalBaseline + band,
      bandLower: seasonalBaseline - band,
      belowBaseline: r.net < seasonalBaseline - band,
      categories: JSON.parse(r.category_totals || '{}'),
    };
  });

  // Current month status
  const now = new Date();
  const cy = now.getFullYear(), cm = now.getMonth() + 1;
  const daysInMonth = new Date(cy, cm, 0).getDate();
  const mtdFraction = Math.max(now.getDate() / daysInMonth, 0.01);
  const cur = db.prepare('SELECT * FROM monthly_actuals WHERE user_id = ? AND year = ? AND month = ?')
    .get(req.user.id, cy, cm);

  let status = 'good', currentMTD = null;
  if (cur) {
    const q = getQuarter(cm);
    const seasonalBaseline = bl.avg_monthly_income - bl.avg_monthly_spending * (sm[q] || 1.0);
    const projectedNet = cur.net / mtdFraction;
    if (projectedNet < seasonalBaseline - band) status = 'red';
    else if (projectedNet < seasonalBaseline) status = 'warning';
    currentMTD = { net: cur.net, projectedNet, baseline: seasonalBaseline, pctOfMonth: Math.round(mtdFraction * 100) };
  }

  res.json({
    baseline: {
      avgMonthlyIncome: bl.avg_monthly_income,
      avgMonthlySpending: bl.avg_monthly_spending,
      avgMonthlyNet: bl.avg_monthly_net,
      seasonalMultipliers: sm,
      monthsOfData: bl.months_of_data,
      computedAt: bl.computed_at,
    },
    months,
    currentMTD,
    status,
  });
});

module.exports = router;
