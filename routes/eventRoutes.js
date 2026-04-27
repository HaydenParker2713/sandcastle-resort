const express    = require('express');
const rateLimit  = require('express-rate-limit');
const multer     = require('multer');
const path       = require('path');
const fs         = require('fs');
const { eventService } = require('../services');
const { requireRole }  = require('../middleware/auth');

const createLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many event submissions. Please try again later.' }
});

const router = express.Router();

const uploadDir = path.join(__dirname, '..', 'public', 'uploads', 'events');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename:    (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `event-${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const extOk  = /\.(jpe?g|png|gif|webp)$/.test(path.extname(file.originalname).toLowerCase());
    const mimeOk = /^image\/(jpeg|png|gif|webp)$/.test(file.mimetype);
    if (extOk && mimeOk) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPG, PNG, GIF, WebP) are allowed.'));
    }
  }
});

router.get('/', async (req, res) => {
  try {
    const events = await eventService.getAll();
    res.json(events);
  } catch (err) {
    console.error('Get events error:', err);
    res.status(500).json({ error: 'Server error fetching events.' });
  }
});

router.post('/', requireRole('staff', 'admin'), createLimiter, upload.single('image'), async (req, res) => {
  try {
    const { title, description, event_date, event_time, location, ticket_info, banner_emoji } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required.' });
    if (title.length > 255)       return res.status(400).json({ error: 'Title must be 255 characters or fewer.' });
    if (description && description.length > 2000) return res.status(400).json({ error: 'Description must be 2000 characters or fewer.' });
    if (location && location.length > 255)   return res.status(400).json({ error: 'Location must be 255 characters or fewer.' });
    if (ticket_info && ticket_info.length > 255) return res.status(400).json({ error: 'Ticket info must be 255 characters or fewer.' });

    const image_path = req.file ? `/uploads/events/${req.file.filename}` : null;
    const event = await eventService.create({
      title, description, event_date, event_time, location, ticket_info, banner_emoji,
      image_path,
      created_by: req.session.user.user_id
    });
    res.status(201).json(event);
  } catch (err) {
    console.error('Create event error:', err);
    res.status(500).json({ error: 'Server error creating event.' });
  }
});

router.delete('/:id', requireRole('staff', 'admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid event ID.' });

    const imagePath = await eventService.delete(id);
    if (imagePath && imagePath.startsWith('/uploads/events/') && !imagePath.includes('..')) {
      const fullPath = path.join(__dirname, '..', 'public', imagePath);
      fs.unlink(fullPath, () => {});
    }
    res.json({ message: 'Event deleted.' });
  } catch (err) {
    console.error('Delete event error:', err);
    res.status(500).json({ error: 'Server error deleting event.' });
  }
});

// Catch multer errors and return JSON instead of Express's default HTML error page
router.use((err, req, res, next) => {
  if (err && err.message) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

module.exports = router;
