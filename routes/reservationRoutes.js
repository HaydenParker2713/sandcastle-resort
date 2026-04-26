const express = require('express');
const { pool } = require('../config/db');
const createServices = require('../services');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
const { reservationService } = createServices(pool);

router.get('/', requireRole('admin', 'staff'), async (req, res) => {
  try {
    const rows = await reservationService.getAllReservations();
    res.json(rows);
  } catch (err) {
    console.error('Get all reservations error:', err);
    res.status(500).json({ error: 'Server error fetching reservations.' });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const user_id = req.session.user.user_id;
    const { unit_id, check_in, check_out, adults, children } = req.body;

    if (!unit_id || !check_in || !check_out) {
      return res.status(400).json({ error: 'unit_id, check_in and check_out are required.' });
    }

    const reservationId = await reservationService.createReservation({
      user_id,
      unit_id: Number(unit_id),
      check_in,
      check_out,
      adults: Number(adults) || 1,
      children: Number(children) || 0
    });

    res.status(201).json({ message: 'Reservation created.', reservation_id: reservationId });
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
    const reservation_id = req.params.id;

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
