const nodemailer = require('nodemailer');

let transporter = null;

async function getTransporter() {
  if (transporter) return transporter;

  if (process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
  } else {
    const test = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: { user: test.user, pass: test.pass }
    });
    console.log('📧 Email: using Ethereal test account — preview URLs will appear in console');
  }

  return transporter;
}

async function sendBookingConfirmation({ to, firstName, unitCode, typeName, checkIn, checkOut, nights, totalAmount, reservationId }) {
  try {
    const transport = await getTransporter();

    const fmtDate = (val) => {
      const [y, m, d] = String(val).split('T')[0].split('-').map(Number);
      return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    };

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:Inter,Arial,sans-serif;margin:0;padding:0;background:#f0f7f7">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(12,74,74,.12)">
    <div style="background:linear-gradient(135deg,#0c4a4a,#0ea5a4);padding:36px 32px;text-align:center">
      <div style="font-size:2.4rem;margin-bottom:8px">🏖️</div>
      <h1 style="color:#fff;margin:0;font-size:1.5rem;font-weight:800;letter-spacing:-0.5px">Sandcastle Resort</h1>
      <p style="color:rgba(255,255,255,.85);margin:6px 0 0;font-size:14px">Booking Confirmed</p>
    </div>

    <div style="padding:32px">
      <p style="font-size:16px;color:#111;margin:0 0 8px;font-weight:700">Hi ${firstName}! Your stay is confirmed 🎉</p>
      <p style="font-size:14px;color:#6b7280;margin:0 0 24px">Here's a summary of your reservation. We look forward to seeing you!</p>

      <div style="background:#f0f9f9;border-radius:12px;padding:20px 24px;margin-bottom:24px">
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr>
            <td style="padding:9px 0;color:#6b7280;font-weight:600;width:130px">Confirmation</td>
            <td style="padding:9px 0;color:#0c4a4a;font-weight:800">#${reservationId}</td>
          </tr>
          <tr style="border-top:1px solid #e5f0f0">
            <td style="padding:9px 0;color:#6b7280;font-weight:600">Unit</td>
            <td style="padding:9px 0;color:#111">${unitCode} – ${typeName}</td>
          </tr>
          <tr style="border-top:1px solid #e5f0f0">
            <td style="padding:9px 0;color:#6b7280;font-weight:600">Check-in</td>
            <td style="padding:9px 0;color:#111">${fmtDate(checkIn)}</td>
          </tr>
          <tr style="border-top:1px solid #e5f0f0">
            <td style="padding:9px 0;color:#6b7280;font-weight:600">Check-out</td>
            <td style="padding:9px 0;color:#111">${fmtDate(checkOut)}</td>
          </tr>
          <tr style="border-top:1px solid #e5f0f0">
            <td style="padding:9px 0;color:#6b7280;font-weight:600">Duration</td>
            <td style="padding:9px 0;color:#111">${nights} night${nights !== 1 ? 's' : ''}</td>
          </tr>
          <tr style="border-top:2px solid #0ea5a4">
            <td style="padding:14px 0 6px;color:#0c4a4a;font-weight:800;font-size:15px">Total Due</td>
            <td style="padding:14px 0 6px;color:#0ea5a4;font-weight:800;font-size:1.4rem">$${Number(totalAmount).toFixed(2)}</td>
          </tr>
        </table>
      </div>

      <p style="font-size:13px;color:#6b7280;margin:0 0 4px">Payment is due at check-in. You can view and manage your booking in your dashboard.</p>
    </div>

    <div style="background:#f0f9f9;padding:18px 32px;text-align:center;border-top:1px solid #e5f0f0">
      <p style="font-size:12px;color:#9ca3af;margin:0">© 2026 Sandcastle Resort · Demo Application</p>
    </div>
  </div>
</body>
</html>`;

    const info = await transport.sendMail({
      from: process.env.SMTP_FROM || '"Sandcastle Resort" <noreply@sandcastle.com>',
      to,
      subject: `Booking Confirmed – ${unitCode} · ${String(checkIn).split('T')[0]}`,
      html
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) console.log(`📧 Email preview: ${previewUrl}`);
  } catch (err) {
    console.error('Email error (booking still confirmed):', err.message);
  }
}

async function sendPasswordChangedNotice({ to, firstName }) {
  try {
    const transport = await getTransporter();

    const html = `<!DOCTYPE html>
<html>
<body style="font-family:Inter,Arial,sans-serif;margin:0;padding:0;background:#f0f7f7">
  <div style="max-width:480px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(12,74,74,.12)">
    <div style="background:linear-gradient(135deg,#0c4a4a,#0ea5a4);padding:28px 32px;text-align:center">
      <h1 style="color:#fff;margin:0;font-size:1.3rem;font-weight:800">Sandcastle Resort</h1>
    </div>
    <div style="padding:32px">
      <p style="font-size:15px;color:#111;margin:0 0 12px">Hi ${firstName},</p>
      <p style="font-size:14px;color:#374151;margin:0 0 20px">Your account password was just changed. If you did not make this change, please contact us immediately.</p>
      <p style="font-size:13px;color:#6b7280;margin:0">This is an automated security notice.</p>
    </div>
  </div>
</body>
</html>`;

    const info = await transport.sendMail({
      from: process.env.SMTP_FROM || '"Sandcastle Resort" <noreply@sandcastle.com>',
      to,
      subject: 'Your Sandcastle Resort password was changed',
      html
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) console.log(`📧 Email preview: ${previewUrl}`);
  } catch (err) {
    console.error('Email error:', err.message);
  }
}

module.exports = { sendBookingConfirmation, sendPasswordChangedNotice };
