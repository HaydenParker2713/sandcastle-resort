// ── Unit-type routes  /api/unit-types ─────────────────────────────────────────
// Admin can view and update per-type info: description, amenities, display photo.

const express = require('express');
const path    = require('path');
const fs      = require('fs');
const multer  = require('multer');
const { unitService } = require('../services');
const { requireRole } = require('../middleware/auth');
const { logAction } = require('../utils/audit');

const router = express.Router();

// Uploaded photos stored at public/uploads/units/ → served as /uploads/units/<file>
const uploadDir = path.join(__dirname, '..', 'public', 'uploads', 'units');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename:    (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `unit-type-${Date.now()}${ext}`);
  }
});

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const ALLOWED_EXT  = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_MIME.has(file.mimetype) || !ALLOWED_EXT.has(ext)) {
      return cb(new Error('Only JPEG, PNG, WebP, or GIF images are allowed (max 5 MB).'));
    }
    cb(null, true);
  }
});

// GET /api/unit-types — list all types with their editable details (public)
router.get('/', async (req, res) => {
  try {
    const types = await unitService.getAllUnitTypes();
    res.json(types);
  } catch (err) {
    console.error('Get unit types error:', err);
    res.status(500).json({ error: 'Server error fetching unit types.' });
  }
});

// PATCH /api/unit-types/:id — admin updates a room type's description, amenities, photo
// Multer is called as a promise inside try/catch so any file errors return JSON, not HTML.
router.patch('/:id', ...requireRole('admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid unit type ID.' });

    await new Promise((resolve, reject) =>
      upload.single('photo')(req, res, (err) => (err ? reject(err) : resolve()))
    );

    const updates = {};
    if (req.body.description   !== undefined) updates.description  = req.body.description.trim() || null;
    if (req.body.amenities     !== undefined) updates.amenities    = req.body.amenities.trim()   || null;
    if (req.body.nightly_rate  !== undefined && req.body.nightly_rate !== '') {
      const rate = parseFloat(req.body.nightly_rate);
      if (isNaN(rate) || rate < 0) return res.status(400).json({ error: 'Invalid nightly rate.' });
      updates.nightly_rate = rate;
    }
    if (req.file)                             updates.photo_url    = `/uploads/units/${req.file.filename}`;

    if (!Object.keys(updates).length) {
      return res.status(400).json({ error: 'Nothing to update.' });
    }

    const ok = await unitService.updateUnitTypeDetails(id, updates);
    if (!ok) return res.status(404).json({ error: 'Unit type not found.' });

    const actor      = req.session.user;
    const typeInfo   = await unitService.getUnitTypeById(id);
    const logDetail  = { type_name: typeInfo?.type_name, ...updates };
    delete logDetail.photo_url;
    if (req.file) logDetail.photo_updated = true;
    logAction(actor.user_id, `${actor.first_name} ${actor.last_name}`,
      'room_type.edit', 'room_type', id, logDetail);

    res.json({ message: 'Room type updated.', ...(req.file ? { photo_url: updates.photo_url } : {}) });
  } catch (err) {
    console.error('Update unit type error:', err);
    res.status(500).json({ error: err.message || 'Server error updating room type.' });
  }
});

module.exports = router;
