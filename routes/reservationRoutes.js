const express    = require('express');
const rateLimit  = require('express-rate-limit');
const { reservationService } = require('../services/index');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAction } = require('../utils/audit');
const appEvents = require('../events');
const { ROLES } = require('../constants');

const createLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many reservation requests. Please try again later.' },
});

const router = express.Router();

router.get('/', requireRole(ROLES.ADMIN, ROLES.STAFF), async (req, res, next) => {
  try {
    res.json(await reservationService.getAllReservations());
  } catch (err) { next(err); }
});

router.post('/', requireAuth, createLimiter, async (req, res, next) => {
  try {
    const user_id = req.session.user.user_id;
    const { unit_id, check_in, check_out, adults, children } = req.body;

    if (!unit_id || !check_in || !check_out) {
      return res.status(400).json({ error: 'unit_id, check_in and check_out are required.' });
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(check_in) || !dateRegex.test(check_out)) {
      return res.status(400).json({ error: 'Dates must be in YYYY-MM-DD format.' });
    }
    const today = new Date().toISOString().split('T')[0];
    if (check_in < today) {
      return res.status(400).json({ error: 'Check-in date cannot be in the past.' });
    }
    if (check_out <= check_in) {
      return res.status(400).json({ error: 'Check-out must be after check-in.' });
    }

    const reservationId = await reservationService.createReservation({
      user_id,
      unit_id:  Number(unit_id),
      check_in,
      check_out,
      adults:   Number(adults) || 1,
      children: Number(children) || 0,
    });

    res.status(201).json({ message: 'Reservation created.', reservation_id: reservationId });
    appEvents.emit('reservation.created', { reservationId });
  } catch (err) { next(err); }
});

router.get('/mine', requireAuth, async (req, res, next) => {
  try {
    res.json(await reservationService.getReservationsByUser(req.session.user.user_id));
  } catch (err) { next(err); }
});

router.post('/:id/cancel', requireAuth, async (req, res, next) => {
  try {
    const reservation_id = parseInt(req.params.id, 10);
    if (isNaN(reservation_id)) return res.status(400).json({ error: 'Invalid reservation ID.' });

    const user_id = req.session.user.user_id;
    const isAdmin = req.session.user.role_name === ROLES.ADMIN;

    const resInfo = await reservationService.getReservationById(reservation_id);
    await reservationService.cancelReservation(reservation_id, user_id, isAdmin);

    const actor = req.session.user;
    logAction(actor.user_id, `${actor.first_name} ${actor.last_name}`,
      'reservation.cancel', 'reservation', reservation_id, {
        guest_name:        resInfo ? `${resInfo.first_name} ${resInfo.last_name}` : null,
        guest_email:       resInfo?.email,
        unit_code:         resInfo?.unit_code,
        type_name:         resInfo?.type_name,
        check_in:          resInfo?.check_in,
        check_out:         resInfo?.check_out,
        amount:            resInfo?.total_amount,
        cancelled_by_role: actor.role_name,
      });
    res.json({ message: 'Reservation cancelled.' });
  } catch (err) { next(err); }
});

module.exports = router;
