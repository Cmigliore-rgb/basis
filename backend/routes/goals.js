const express = require('express');
const router = express.Router();
const store = require('../store');

router.get('/', (req, res) => {
  res.json({ goals: req.app.locals.goals || [] });
});

router.post('/', (req, res) => {
  const { name, target, accountId } = req.body;
  if (!name || !target) return res.status(400).json({ error: 'name and target required' });
  const goal = { id: Date.now().toString(), name, target: parseFloat(target), accountId: accountId || null, createdAt: new Date().toISOString().slice(0, 10) };
  req.app.locals.goals = [...(req.app.locals.goals || []), goal];
  store.save(req.app);
  res.json({ goal });
});

router.put('/:id', (req, res) => {
  const { name, target, accountId } = req.body;
  const goals = req.app.locals.goals || [];
  const idx = goals.findIndex(g => g.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'not found' });
  goals[idx] = { ...goals[idx], name: name ?? goals[idx].name, target: target != null ? parseFloat(target) : goals[idx].target, accountId: accountId !== undefined ? accountId : goals[idx].accountId };
  req.app.locals.goals = goals;
  store.save(req.app);
  res.json({ goal: goals[idx] });
});

router.delete('/:id', (req, res) => {
  req.app.locals.goals = (req.app.locals.goals || []).filter(g => g.id !== req.params.id);
  store.save(req.app);
  res.json({ ok: true });
});

module.exports = router;
