const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/requireAuth');
const { getHoldings } = require('../data_controller');

router.get('/holdings', requireAuth, async (req, res) => {
  try {
    res.json(await getHoldings(req));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
