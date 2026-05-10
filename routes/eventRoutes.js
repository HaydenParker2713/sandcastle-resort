const express    = require('express');
const rateLimit  = require('express-rate-limit');
const path       = require('path');
const fs         = require('fs');
const { eventService } = require('../services/index');
const { requireRole }  = require('../middleware/auth');
const { createUploader } = require('../middleware/upload');
const { ROLES }        = require('../constants');

const createLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many event submissions. Please try again later.' },
});

const router = express.Router();
const upload = createUploader('events', 'event-');

router.get('/', async (req, res, next) => {
  try {
    res.json(await eventService.getAll());
  } catch (err) { next(err); }
});

router.post('/', requireRole(ROLES.STAFF, ROLES.ADMIN), createLimiter, upload.single('image'), async (req, res, next) => {
  try {
    const { title, description, event_date, event_time, location, ticket_info, banner_emoji } = req.body;

    if (!title) return res.status(400).json({ error: 'Title is required.' });
    if (title.length > 255) return res.status(400).json({ error: 'Title must be 255 characters or fewer.' });

    if (event_date !== undefined && event_date !== '' && event_date !== null) {
      const dateRe = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRe.test(event_date) || isNaN(Date.parse(event_date))) {
        return res.status(400).json({ error: 'event_date must be a valid date in YYYY-MM-DD format.' });
      }
    }

    if (description && description.length > 2000) return res.status(400).json({ error: 'Description must be 2000 characters or fewer.' });
    if (location && location.length > 255)          return res.status(400).json({ error: 'Location must be 255 characters or fewer.' });
    if (ticket_info && ticket_info.length > 255)   return res.status(400).json({ error: 'Ticket info must be 255 characters or fewer.' });

    const image_path = req.file ? `/uploads/events/${req.file.filename}` : null;
    const event = await eventService.create({
      title, description, event_date, event_time, location, ticket_info, banner_emoji,
      image_path,
      created_by: req.session.user.user_id,
    });
    res.status(201).json(event);
  } catch (err) { next(err); }
});

router.delete('/:id', requireRole(ROLES.STAFF, ROLES.ADMIN), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid event ID.' });

    const result = await eventService.delete(id);
    if (!result.found) return res.status(404).json({ error: 'Event not found.' });

    if (result.imagePath?.startsWith('/uploads/events/') && !result.imagePath.includes('..')) {
      fs.unlink(path.join(__dirname, '..', 'public', result.imagePath), () => {});
    }
    res.json({ message: 'Event deleted.' });
  } catch (err) { next(err); }
});

// Catch multer errors and return JSON instead of Express's default HTML error page.
router.use((err, req, res, next) => {
  if (err?.message) return res.status(400).json({ error: err.message });
  next(err);
});

module.exports = router;
