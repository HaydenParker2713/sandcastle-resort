const appEvents = require('../index');
const { reservationService } = require('../../services');
const { sendBookingConfirmation, sendPasswordChangedNotice } = require('../../utils/email');

appEvents.on('reservation.created', async ({ reservationId }) => {
  try {
    const details = await reservationService.getReservationById(reservationId);
    if (!details) return;
    const nights = Math.round((new Date(details.check_out) - new Date(details.check_in)) / 86400000);
    await sendBookingConfirmation({
      to:          details.email,
      firstName:   details.first_name,
      unitCode:    details.unit_code,
      typeName:    details.type_name,
      checkIn:     details.check_in,
      checkOut:    details.check_out,
      nights,
      totalAmount: details.total_amount,
      reservationId,
    });
  } catch (err) {
    console.error('Confirmation email failed:', err.message);
  }
});

appEvents.on('auth.password_changed', async ({ email, firstName }) => {
  try {
    await sendPasswordChangedNotice({ to: email, firstName });
  } catch (err) {
    console.error('Security notice email failed:', err.message);
  }
});
