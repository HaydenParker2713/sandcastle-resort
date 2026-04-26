const express = require('express');
const { pool } = require('../config/db');
const createServices = require('../services');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const { reviewService, reservationService } = createServices(pool);

router.post('/', requireAuth, async (req, res) => {
  try {
    const user_id = req.session.user.user_id;
    const { reservation_id, rating, comment } = req.body;

    if (!reservation_id || !rating) {
      return res.status(400).json({ error: 'reservation_id and rating are required.' });
    }
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5.' });
    }

    // Verify reservation belongs to this user
    const [rows] = await pool.execute(
      `SELECT unit_id FROM reservations WHERE reservation_id = ? AND user_id = ?`,
      [reservation_id, user_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Reservation not found.' });

    const existing = await reviewService.getReviewByReservation(reservation_id);
    if (existing) return res.status(409).json({ error: 'You already reviewed this stay.' });

    const review_id = await reviewService.createReview({
      reservation_id,
      user_id,
      unit_id: rows[0].unit_id,
      rating: Number(rating),
      comment
    });

    res.status(201).json({ message: 'Review submitted.', review_id });
  } catch (err) {
    console.error('Create review error:', err);
    res.status(500).json({ error: 'Server error submitting review.' });
  }
});

router.get('/mine', requireAuth, async (req, res) => {
  try {
    const user_id = req.session.user.user_id;
    const [rows] = await pool.execute(
      `SELECT reservation_id FROM reviews WHERE user_id = ?`,
      [user_id]
    );
    res.json(rows.map(r => r.reservation_id));
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

router.get('/unit/:unit_id', async (req, res) => {
  try {
    const reviews = await reviewService.getReviewsByUnit(req.params.unit_id);
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching reviews.' });
  }
});

module.exports = router;
