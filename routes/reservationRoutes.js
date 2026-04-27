const express    = require('express');
const rateLimit  = require('express-rate-limit');
const { reservationService } = require('../services');
const { requireAuth, requireRole } = require('../middleware/auth');
const { sendBookingConfirmation } = require('../utils/email');

const createLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many reservation requests. Please try again later.' }
});

const router = express.Router();

router.get('/', requireRole('admin', 'staff'), async (req, res) => {
  try {
    const rows = await reservationService.getAllReservations();
    res.json(rows);
  } catch (err) {
    console.error('Get all reservations error:', err);
    res.status(500).json({ error: 'Server error fetching reservations.' });
  }
});

router.post('/', requireAuth, createLimiter, async (req, res) => {
  try {
    const user_id = req.session.user.user_id;
    const { unit_id, check_in, check_out, adults, children } = req.body;

    if (!unit_id || !check_in || !check_out) {
      return res.status(400).json({ error: 'unit_id, check_in and check_out are required.' });
    }

    const reservationId = await reservationService.createReservation({
      user_id,
      unit_id:  Number(unit_id),
      check_in,
      check_out,
      adults:   Number(adults) || 1,
      children: Number(children) || 0
    });

    res.status(201).json({ message: 'Reservation created.', reservation_id: reservationId });

    // Fire-and-forget confirmation email
    reservationService.getReservationById(reservationId).then(details => {
      if (!details) return;
      const nights = Math.round((new Date(details.check_out) - new Date(details.check_in)) / 86400000);
      return sendBookingConfirmation({
        to:            details.email,
        firstName:     details.first_name,
        unitCode:      details.unit_code,
        typeName:      details.type_name,
        checkIn:       details.check_in,
        checkOut:      details.check_out,
        nights,
        totalAmount:   details.total_amount,
        reservationId
      });
    }).catch(err => console.error('Confirmation email failed:', err.message));
  } catch (err) {
    if (err && err.code === 'DOUBLE_BOOKING') {
      return res.status(409).json({ error: err.message });
    }
    console.error('Create reservation error:', err);
    res.status(500).json({ error: 'Server error creating reservation.' });
  }
});

router.get('/mine', requireAuth, async (req, res) => {
  try {
    const user_id = req.session.user.user_id;
    const rows = await reservationService.getReservationsByUser(user_id);
    res.json(rows);
  } catch (err) {
    console.error('Get reservations error:', err);
    res.status(500).json({ error: 'Server error fetching reservations.' });
  }
});

router.post('/:id/cancel', requireAuth, async (req, res) => {
  try {
    const user_id = req.session.user.user_id;
    const isAdmin = req.session.user.role_name === 'admin';
    const reservation_id = parseInt(req.params.id, 10);
    if (isNaN(reservation_id)) return res.status(400).json({ error: 'Invalid reservation ID.' });

    try {
      const ok = await reservationService.cancelReservation(reservation_id, user_id, isAdmin);
      if (!ok) return res.status(404).json({ error: 'Reservation not found.' });
      res.json({ message: 'Reservation cancelled.' });
    } catch (err) {
      if (err && err.code === 'NOT_ALLOWED') return res.status(403).json({ error: 'Not allowed.' });
      throw err;
    }
  } catch (err) {
    console.error('Cancel reservation error:', err);
    res.status(500).json({ error: 'Server error cancelling reservation.' });
  }
});

module.exports = router;