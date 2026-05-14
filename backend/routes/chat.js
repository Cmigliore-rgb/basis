const express = require('express');
const router = express.Router();
const Groq = require('groq-sdk');
const requireAuth = require('../middleware/requireAuth');
const db = require('../db');

const DAILY_LIMIT = 50;
const usage = new Map(); // userId -> { count, day }

function checkRateLimit(userId) {
  const today = new Date().toISOString().slice(0, 10);
  const entry = usage.get(userId);
  if (!entry || entry.day !== today) {
    usage.set(userId, { count: 1, day: today });
    return true;
  }
  if (entry.count >= DAILY_LIMIT) return false;
  entry.count++;
  return true;
}

const SYSTEM_PROMPT = `You are a personal financial advisor assistant built into Ledger, a personal finance dashboard.

CRITICAL RULES:
- You will be given the user's REAL financial data below. Use ONLY those exact numbers. Never invent, estimate, or use placeholder figures.
- If the data section is empty or a field is missing, say "I don't see that data connected yet" — do NOT make up numbers.
- Every dollar figure you state must come directly from the provided data.

Be concise, specific, and actionable. Format dollar amounts with $ and commas. If you spot trends or anomalies, call them out.

You can help with spending analysis, budget tracking, investment portfolio review, savings rate, specific transaction questions, and general financial planning.

Write in plain conversational paragraphs like a knowledgeable friend, not a financial advisor. No bullet points, no numbered lists, no headers, no em dashes. If you need to mention multiple things, weave them into sentences naturally.`;

router.post('/', requireAuth, async (req, res) => {
  const user = db.prepare('SELECT tier FROM users WHERE id = ?').get(req.user.id);
  if (user?.tier !== 'premium') return res.status(403).json({ error: 'Premium required' });
  if (!checkRateLimit(req.user.id)) return res.status(429).json({ error: 'Daily message limit reached. Try again tomorrow.' });

  const { message, history = [], context = {} } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'message is required' });
  }

  const { accounts = [], transactions = [], holdings = [], budget = {} } = context;
  const contextBlock = buildContextBlock(accounts, transactions, holdings, budget);

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT + '\n\n' + contextBlock },
    ...history.map(msg => ({ role: msg.role === 'assistant' ? 'assistant' : 'user', content: msg.content })),
    { role: 'user', content: message },
  ];

  console.log('Chat context — accounts:', accounts.length, '| txns:', transactions.length, '| holdings:', holdings.length);
  console.log('Context block preview:\n', contextBlock.slice(0, 500));

  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages,
      max_tokens: 1024,
    });

    const text = completion.choices[0]?.message?.content || '';
    res.json({ reply: text });
  } catch (err) {
    console.error('Groq API error:', err.message);
    res.status(500).json({ error: 'Failed to get response', details: err.message });
  }
});

function buildContextBlock(accounts, transactions, holdings, budget) {
  const lines = ['## My Financial Data\n'];

  if (accounts.length) {
    lines.push('### Accounts');
    for (const a of accounts) {
      const balance = a.balance ?? 'N/A';
      lines.push(`- ${a.name} (${a.subtype || a.type || 'account'}): $${Number(balance).toLocaleString()}`);
    }
    lines.push('');
  }

  if (holdings.length) {
    lines.push('### Investment Holdings');
    for (const h of holdings) {
      lines.push(`- ${h.ticker || h.name}: ${h.quantity} shares @ $${h.price ?? 'N/A'} = $${Number(h.value || 0).toLocaleString()}`);
    }
    lines.push('');
  }

  if (transactions.length) {
    lines.push('### Recent Transactions (last 30 days)');
    for (const t of transactions) {
      const amt = t.amount != null ? `$${Math.abs(t.amount).toFixed(2)}` : '';
      const direction = t.amount > 0 ? 'debit' : 'credit';
      lines.push(`- [${t.date || ''}] ${t.name}: ${amt} (${direction})${t.category ? ` — ${t.category}` : ''}`);
    }
    lines.push('');
  }

  if (budget && Object.keys(budget).length) {
    lines.push('### Budget Summary (this month)');
    for (const [category, data] of Object.entries(budget)) {
      if (typeof data === 'object' && data.spent != null) {
        lines.push(`- ${category}: $${Number(data.spent).toLocaleString()} spent`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}

module.exports = router;
