const FROM = 'PeakLedger <support@peakledger.app>';

async function send({ to, subject, html }) {
  if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY not set');
  const { Resend } = require('resend');
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({ from: FROM, to, subject, html });
  if (error) throw new Error(error.message);
}

module.exports = { send, isConfigured: () => !!process.env.RESEND_API_KEY };
