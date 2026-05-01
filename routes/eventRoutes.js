// ── Event routes  /api/events ─────────────────────────────────────────────────
// Staff and admin can create/delete resort events with optional image uploads.
// Events are publicly readable (no auth required on GET).

const express    = require('express');
const rateLimit  = require('express-rate-limit');
const multer     = require('multer');  // handles multipart/form-data (file uploads)
const path       = require('path');
const fs         = require('fs');
const { eventService } = require('../services');
const { requireRole }  = require('../middleware/auth');

// Limit event creation to 20 per hour per IP
const createLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many event submissions. Please try again later.' }
});

const router = express.Router();

// ── File upload configuration ─────────────────────────────────────────────────
// Uploaded images are stored on disk under public/uploads/events/
// so they can be served as static files at /uploads/events/<filename>.
const uploadDir = path.join(__dirname, '..', 'public', 'uploads', 'events');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  // Rename to event-<timestamp>.<ext> to avoid filename collisions
  filename:    (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `event-${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  // Validate BOTH the file extension AND the MIME type reported by the browser.
  // Checking only one is insufficient because an attacker could rename a PHP
  // file to .jpg (extension check bypassed) or spoof the Content-Type header.
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

// GET /api/events — public, returns all events ordered soonest first
router.get('/', async (req, res) => {
  try {
    const events = await eventService.getAll();
    res.json(events);
  } catch (err) {
    console.error('Get events error:', err);
    res.status(500).json({ error: 'Server error fetching events.' });
  }
});

// POST /api/events — staff/admin create a new event
// Uses multer middleware to handle the image upload before the handler runs.
// If multer rejects the file (wrong type / too large) the error handler below returns JSON.
router.post('/', requireRole('staff', 'admin'), createLimiter, upload.single('image'), async (req, res) => {
  try {
    const { title, description, event_date, event_time, location, ticket_info, banner_emoji } = req.body;

    // Title is the only required field; all others are optional
    if (!title) return res.status(400).json({ error: 'Title is required.' });
    if (title.length > 255)       return res.status(400).json({ error: 'Title must be 255 characters or fewer.' });
    if (description && description.length > 2000) return res.status(400).json({ error: 'Description must be 2000 characters or fewer.' });
    if (location && location.length > 255)   return res.status(400).json({ error: 'Location must be 255 characters or fewer.' });
    if (ticket_info && ticket_info.length > 255) return res.status(400).json({ error: 'Ticket info must be 255 characters or fewer.' });

    // req.file is set by multer if a file was uploaded; otherwise image_path is null
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

// DELETE /api/events/:id — staff/admin delete an event and its uploaded image file
router.delete('/:id', requireRole('staff', 'admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid event ID.' });

    // eventService.delete returns the stored image_path before removing the DB row
    const imagePath = await eventService.delete(id);

    // Delete the image file from disk — guard against path traversal attacks
    // by requiring the path starts with /uploads/events/ and contains no '..'
    if (imagePath && imagePath.startsWith('/uploads/events/') && !imagePath.includes('..')) {
      const fullPath = path.join(__dirname, '..', 'public', imagePath);
      fs.unlink(fullPath, () => {}); // ignore errors (file may already be gone)
    }
    res.json({ message: 'Event deleted.' });
  } catch (err) {
    console.error('Delete event error:', err);
    res.status(500).json({ error: 'Server error deleting event.' });
  }
});

// ── Multer error handler ──────────────────────────────────────────────────────
// Without this, multer's errors bubble up as Express's default HTML error page.
// This middleware catches multer errors and returns a JSON response instead.
router.use((err, req, res, next) => {
  if (err && err.message) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

module.exports = router;
