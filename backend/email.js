let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return null;
  try {
    const nodemailer = require('nodemailer');
    _transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });
    return _transporter;
  } catch { return null; }
}

async function send({ to, subject, html }) {
  const t = getTransporter();
  if (!t) throw new Error('Email not configured. Add EMAIL_USER and EMAIL_PASS to backend .env.');
  return t.sendMail({ from: `Basis <${process.env.EMAIL_USER}>`, to, subject, html });
}

module.exports = { send, isConfigured: () => !!getTransporter() };
