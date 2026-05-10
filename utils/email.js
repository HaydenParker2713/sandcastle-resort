const nodemailer = require('nodemailer');
const { getTransporter } = require('./mailer');
const { bookingConfirmationHtml, passwordChangedHtml, passwordResetHtml } = require('./emailTemplates');

async function sendBookingConfirmation({ to, firstName, unitCode, typeName, checkIn, checkOut, nights, totalAmount, reservationId }) {
  try {
    const transport = await getTransporter();
    const info = await transport.sendMail({
      from:    process.env.SMTP_FROM || '"Sandcastle Resort" <noreply@sandcastle.com>',
      to,
      subject: `Booking Confirmed – ${unitCode} · ${String(checkIn).split('T')[0]}`,
      html:    bookingConfirmationHtml({ firstName, unitCode, typeName, checkIn, checkOut, nights, totalAmount, reservationId }),
    });
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) console.log(`📧 Email preview: ${previewUrl}`);
  } catch (err) {
    console.error('Email error (booking still confirmed):', err.message);
    // Do not re-throw — a failed confirmation email must not fail the booking.
  }
}

async function sendPasswordChangedNotice({ to, firstName }) {
  try {
    const transport = await getTransporter();
    const info = await transport.sendMail({
      from:    process.env.SMTP_FROM || '"Sandcastle Resort" <noreply@sandcastle.com>',
      to,
      subject: 'Your Sandcastle Resort password was changed',
      html:    passwordChangedHtml({ firstName }),
    });
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) console.log(`📧 Email preview: ${previewUrl}`);
  } catch (err) {
    console.error('Password-changed email error:', err.message);
    // Do not re-throw — security notice failure should not surface as a 500.
  }
}

// sendPasswordReset throws on failure so the route can invalidate the DB token
// and return a meaningful error rather than silently leaving an unused token.
async function sendPasswordReset({ to, firstName, resetLink }) {
  const transport = await getTransporter();
  const info = await transport.sendMail({
    from:    process.env.SMTP_FROM || '"Sandcastle Resort" <noreply@sandcastle.com>',
    to,
    subject: 'Reset your Sandcastle Resort password',
    html:    passwordResetHtml({ firstName, resetLink }),
  });
  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) console.log(`📧 Password reset email preview: ${previewUrl}`);
}

module.exports = { sendBookingConfirmation, sendPasswordChangedNotice, sendPasswordReset };
