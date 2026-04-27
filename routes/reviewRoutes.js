// ── Review routes  /api/reviews ───────────────────────────────────────────────
// Guests can leave one review per completed stay.
// The public can read reviews by unit; the dashboard shows which stays are reviewed.

const express    = require('express');
const rateLimit  = require('express-rate-limit');
const { reviewService, reservationService } = require('../services');
const { requireAuth } = require('../middleware/auth');

// Limit to 10 reviews per hour per IP — generous but blocks bots
const createLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many review submissions. Please try again later.' }
});

const router = express.Router();

// POST /api/reviews — submit a review for a past stay
// Enforces: must own the reservation, rating 1–5, one review per reservation.
router.post('/', requireAuth, createLimiter, async (req, res) => {
  try {
    const user_id = req.session.user.user_id;
    const { reservation_id, rating, comment } = req.body;

    if (!reservation_id || !rating) {
      return res.status(400).json({ error: 'reservation_id and rating are required.' });
    }
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5.' });
    }
    if (comment && comment.length > 1000) {
      return res.status(400).json({ error: 'Comment must be 1000 characters or fewer.' });
    }

    // Verify the reservation belongs to this user (prevents reviewing other guests' stays)
    const reservation = await reservationService.getReservationOwner(reservation_id, user_id);
    if (!reservation) return res.status(404).json({ error: 'Reservation not found.' });

    // Prevent duplicate reviews on the same stay
    const existing = await reviewService.getReviewByReservation(reservation_id);
    if (existing) return res.status(409).json({ error: 'You already reviewed this stay.' });

    const review_id = await reviewService.createReview({
      reservation_id,
      user_id,
      unit_id: reservation.unit_id,
      rating:  Number(rating),
      comment
    });

    res.status(201).json({ message: 'Review submitted.', review_id });
  } catch (err) {
    console.error('Create review error:', err);
    res.status(500).json({ error: 'Server error submitting review.' });
  }
});

// GET /api/reviews/mine — returns reservation_ids that the current user has reviewed
// The dashboard uses this to toggle the "Leave Review" / "Reviewed" state on each booking card.
router.get('/mine', requireAuth, async (req, res) => {
  try {
    const ids = await reviewService.getReviewedReservationIds(req.session.user.user_id);
    res.json(ids);
  } catch (err) {
    console.error('Get reviewed reservations error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/reviews/unit/:unit_id — public endpoint, returns all reviews for one unit
// Used on unit detail pages to show guest ratings.
router.get('/unit/:unit_id', async (req, res) => {
  try {
    const unit_id = parseInt(req.params.unit_id, 10);
    if (isNaN(unit_id)) return res.status(400).json({ error: 'Invalid unit ID.' });
    const reviews = await reviewService.getReviewsByUnit(unit_id);
    res.json(reviews);
  } catch (err) {
    console.error('Get reviews error:', err);
    res.status(500).json({ error: 'Server error fetching reviews.' });
  }
});

module.exports = router;
