const nodemailer = require('nodemailer');

let transporter = null;

async function getTransporter() {
  if (transporter) return transporter;

  const smtpReady = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;

  if (smtpReady) {
    transporter = nodemailer.createTransport({
      host:   process.env.SMTP_HOST,
      port:   Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth:   { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    console.log(`📧 Email: using SMTP (${process.env.SMTP_HOST})`);
  } else {
    const test = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host:   'smtp.ethereal.email',
      port:   587,
      secure: false,
      auth:   { user: test.user, pass: test.pass },
    });
    console.log('📧 Email: SMTP not configured — using Ethereal preview (check console for links)');
  }

  return transporter;
}

module.exports = { getTransporter };
