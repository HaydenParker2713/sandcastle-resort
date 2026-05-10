const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const fmtDate = (val) => {
  const [y, m, d] = String(val).split('T')[0].split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
};

function bookingConfirmationHtml({ firstName, unitCode, typeName, checkIn, checkOut, nights, totalAmount, reservationId }) {
  return `<!DOCTYPE html>
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
      <p style="font-size:16px;color:#111;margin:0 0 8px;font-weight:700">Hi ${esc(firstName)}! Your stay is confirmed 🎉</p>
      <p style="font-size:14px;color:#6b7280;margin:0 0 24px">Here's a summary of your reservation. We look forward to seeing you!</p>
      <div style="background:#f0f9f9;border-radius:12px;padding:20px 24px;margin-bottom:24px">
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr>
            <td style="padding:9px 0;color:#6b7280;font-weight:600;width:130px">Confirmation</td>
            <td style="padding:9px 0;color:#0c4a4a;font-weight:800">#${reservationId}</td>
          </tr>
          <tr style="border-top:1px solid #e5f0f0">
            <td style="padding:9px 0;color:#6b7280;font-weight:600">Unit</td>
            <td style="padding:9px 0;color:#111">${esc(unitCode)} – ${esc(typeName)}</td>
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
      <p style="font-size:13px;color:#6b7280;margin:0">Payment is due at check-in. You can view and manage your booking in your dashboard.</p>
    </div>
    <div style="background:#f0f9f9;padding:18px 32px;text-align:center;border-top:1px solid #e5f0f0">
      <p style="font-size:12px;color:#9ca3af;margin:0">© 2026 Sandcastle Resort · Demo Application</p>
    </div>
  </div>
</body>
</html>`;
}

function passwordChangedHtml({ firstName }) {
  return `<!DOCTYPE html>
<html>
<body style="font-family:Inter,Arial,sans-serif;margin:0;padding:0;background:#f0f7f7">
  <div style="max-width:480px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(12,74,74,.12)">
    <div style="background:linear-gradient(135deg,#0c4a4a,#0ea5a4);padding:28px 32px;text-align:center">
      <h1 style="color:#fff;margin:0;font-size:1.3rem;font-weight:800">Sandcastle Resort</h1>
    </div>
    <div style="padding:32px">
      <p style="font-size:15px;color:#111;margin:0 0 12px">Hi ${esc(firstName)},</p>
      <p style="font-size:14px;color:#374151;margin:0 0 20px">Your account password was just changed. If you did not make this change, please contact us immediately.</p>
      <p style="font-size:13px;color:#6b7280;margin:0">This is an automated security notice.</p>
    </div>
  </div>
</body>
</html>`;
}

function passwordResetHtml({ firstName, resetLink }) {
  return `<!DOCTYPE html>
<html>
<body style="font-family:Inter,Arial,sans-serif;margin:0;padding:0;background:#f0f7f7">
  <div style="max-width:480px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(12,74,74,.12)">
    <div style="background:linear-gradient(135deg,#0c4a4a,#0ea5a4);padding:28px 32px;text-align:center">
      <div style="font-size:2rem;margin-bottom:8px">🔑</div>
      <h1 style="color:#fff;margin:0;font-size:1.3rem;font-weight:800">Sandcastle Resort</h1>
      <p style="color:rgba(255,255,255,.85);margin:6px 0 0;font-size:13px">Password Reset Request</p>
    </div>
    <div style="padding:32px">
      <p style="font-size:15px;color:#111;margin:0 0 12px">Hi ${esc(firstName)},</p>
      <p style="font-size:14px;color:#374151;margin:0 0 24px">
        We received a request to reset your password. Click the button below to choose a new one.
        This link expires in <strong>1 hour</strong>.
      </p>
      <div style="text-align:center;margin-bottom:24px">
        <a href="${resetLink}"
           style="display:inline-block;background:linear-gradient(135deg,#0c4a4a,#0ea5a4);color:#fff;
                  font-weight:700;font-size:15px;padding:14px 32px;border-radius:10px;
                  text-decoration:none;letter-spacing:-.2px">
          Reset My Password
        </a>
      </div>
      <p style="font-size:12px;color:#9ca3af;margin:0">
        If you didn't request this, you can safely ignore this email — your password won't change.<br><br>
        Or copy this link into your browser:<br>
        <span style="word-break:break-all;color:#0ea5a4">${resetLink}</span>
      </p>
    </div>
    <div style="background:#f0f9f9;padding:14px 32px;text-align:center;border-top:1px solid #e5f0f0">
      <p style="font-size:12px;color:#9ca3af;margin:0">© 2026 Sandcastle Resort · Demo Application</p>
    </div>
  </div>
</body>
</html>`;
}

module.exports = { bookingConfirmationHtml, passwordChangedHtml, passwordResetHtml };
