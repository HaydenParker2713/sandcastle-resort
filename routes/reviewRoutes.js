const express    = require('express');
const rateLimit  = require('express-rate-limit');
const { reviewService, reservationService } = require('../services/index');
const { requireAuth } = require('../middleware/auth');
const { RES_STATUS } = require('../constants');

const createLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many review submissions. Please try again later.' },
});

const router = express.Router();

router.post('/', requireAuth, createLimiter, async (req, res, next) => {
  try {
    const user_id = req.session.user.user_id;
    const { reservation_id, rating, comment } = req.body;

    if (!reservation_id || !rating) {
      return res.status(400).json({ error: 'reservation_id and rating are required.' });
    }
    const ratingNum = Number(rating);
    if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ error: 'Rating must be a number between 1 and 5.' });
    }
    if (comment && comment.length > 1000) {
      return res.status(400).json({ error: 'Comment must be 1000 characters or fewer.' });
    }

    const reservation = await reservationService.getReservationOwner(reservation_id, user_id);
    if (!reservation) return res.status(404).json({ error: 'Reservation not found.' });

    if (reservation.status !== RES_STATUS.CONFIRMED) {
      return res.status(400).json({ error: 'Can only review a confirmed stay.' });
    }
    const checkOutDate = new Date(reservation.check_out);
    checkOutDate.setHours(0, 0, 0, 0);
    if (checkOutDate >= new Date()) {
      return res.status(400).json({ error: 'Reviews can only be submitted after checkout.' });
    }

    const existing = await reviewService.getReviewByReservation(reservation_id);
    if (existing) return res.status(409).json({ error: 'You already reviewed this stay.' });

    const review_id = await reviewService.createReview({
      reservation_id,
      user_id,
      unit_id: reservation.unit_id,
      rating:  ratingNum,
      comment,
    });
    res.status(201).json({ message: 'Review submitted.', review_id });
  } catch (err) { next(err); }
});

router.get('/mine', requireAuth, async (req, res, next) => {
  try {
    res.json(await reviewService.getReviewedReservationIds(req.session.user.user_id));
  } catch (err) { next(err); }
});

router.get('/unit/:unit_id', async (req, res, next) => {
  try {
    const unit_id = parseInt(req.params.unit_id, 10);
    if (isNaN(unit_id)) return res.status(400).json({ error: 'Invalid unit ID.' });
    res.json(await reviewService.getReviewsByUnit(unit_id));
  } catch (err) { next(err); }
});

module.exports = router;
