const express = require('express');
const router = express.Router();
const db = require('../db');
const requireAuth = require('../middleware/requireAuth');

const toClient = g => ({ ...g, accountId: g.account_id });

router.get('/', requireAuth, (req, res) => {
  const goals = db.prepare('SELECT * FROM goals WHERE user_id = ? ORDER BY created_at ASC').all(req.user.id);
  res.json({ goals: goals.map(toClient) });
});

router.post('/', requireAuth, (req, res) => {
  const { name, target, accountId } = req.body;
  if (!name || !target) return res.status(400).json({ error: 'name and target required' });
  const result = db.prepare('INSERT INTO goals (user_id, name, target, account_id) VALUES (?, ?, ?, ?)')
    .run(req.user.id, name, parseFloat(target), accountId || null);
  const goal = db.prepare('SELECT * FROM goals WHERE id = ?').get(result.lastInsertRowid);
  res.json({ goal: toClient(goal) });
});

router.put('/:id', requireAuth, (req, res) => {
  const { name, target, accountId } = req.body;
  const existing = db.prepare('SELECT * FROM goals WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  db.prepare('UPDATE goals SET name = ?, target = ?, account_id = ? WHERE id = ? AND user_id = ?').run(
    name ?? existing.name,
    target != null ? parseFloat(target) : existing.target,
    accountId !== undefined ? (accountId || null) : existing.account_id,
    req.params.id, req.user.id
  );
  const goal = db.prepare('SELECT * FROM goals WHERE id = ?').get(req.params.id);
  res.json({ goal: toClient(goal) });
});

router.delete('/:id', requireAuth, (req, res) => {
  const existing = db.prepare('SELECT * FROM goals WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  db.prepare('DELETE FROM goals WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

module.exports = router;
