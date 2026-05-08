const express = require('express');
const router  = express.Router();
const Stripe  = require('stripe');
const db      = require('../db');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const PRICES = {
  standard: process.env.STRIPE_PRICE_STANDARD,
  student:  process.env.STRIPE_PRICE_STUDENT,
};

const BASE_URL = process.env.FRONTEND_URL || 'https://peakledger.app';

// ── Auth middleware (reuse JWT logic) ─────────────────────────────────────
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'changeme';

function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ── POST /api/stripe/checkout ─────────────────────────────────────────────
router.post('/checkout', auth, async (req, res) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.tier === 'premium') return res.status(400).json({ error: 'Already premium' });

    const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
    const eduAge = user.edu_verified_at ? Date.now() - new Date(user.edu_verified_at).getTime() : Infinity;
    const isEduVerified = user.email_verified && user.email.toLowerCase().endsWith('.edu') && eduAge < ONE_YEAR_MS;
    const priceId = isEduVerified ? PRICES.student : PRICES.standard;

    // Create or retrieve Stripe customer
    let customerId = user.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name:  user.name,
        metadata: { user_id: String(user.id), role: user.role },
      });
      customerId = customer.id;
      db.prepare('UPDATE users SET stripe_customer_id = ? WHERE id = ?').run(customerId, user.id);
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${BASE_URL}/app?upgraded=1`,
      cancel_url:  `${BASE_URL}/app`,
      metadata: { user_id: String(user.id) },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout error:', err);
    res.status(500).json({ error: err.message || 'Failed to create checkout session' });
  }
});

// ── POST /api/stripe/portal ───────────────────────────────────────────────
router.post('/portal', auth, async (req, res) => {
  try {
    const user = db.prepare('SELECT stripe_customer_id FROM users WHERE id = ?').get(req.user.id);
    if (!user?.stripe_customer_id) return res.status(400).json({ error: 'No billing account found' });

    const session = await stripe.billingPortal.sessions.create({
      customer:   user.stripe_customer_id,
      return_url: `${BASE_URL}/app`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe portal error:', err);
    res.status(500).json({ error: 'Failed to open billing portal' });
  }
});

// ── POST /api/stripe/webhook ──────────────────────────────────────────────
// Note: raw body is required — mounted before express.json() in server.js
router.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature failure:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId  = parseInt(session.metadata?.user_id);
    if (userId) {
      db.prepare('UPDATE users SET tier = ?, stripe_subscription_id = ? WHERE id = ?')
        .run('premium', session.subscription, userId);
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object;
    const user = db.prepare('SELECT id FROM users WHERE stripe_customer_id = ?').get(sub.customer);
    if (user) {
      db.prepare('UPDATE users SET tier = ?, stripe_subscription_id = NULL WHERE id = ?')
        .run('free', user.id);
    }
  }

  if (event.type === 'customer.subscription.updated') {
    const sub  = event.data.object;
    const user = db.prepare('SELECT id FROM users WHERE stripe_customer_id = ?').get(sub.customer);
    if (user) {
      const tier = (sub.status === 'active' || sub.status === 'trialing') ? 'premium' : 'free';
      db.prepare('UPDATE users SET tier = ? WHERE id = ?').run(tier, user.id);
    }
  }

  res.json({ received: true });
});

module.exports = router;
