// ── Activity list routes  /api/activity-items ─────────────────────────────────
// Resort activities shown on the public Activities page.
// Anyone can read; only admin can add or remove entries.

const express = require('express');
const { activityListService } = require('../services');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/activity-items — public, returns all activities ordered by sort_order
router.get('/', async (req, res, next) => {
  try {
    res.json(await activityListService.getAll());
  } catch (err) { next(err); }
});

// POST /api/activity-items — admin only, add a new activity
router.post('/', requireRole('admin'), async (req, res, next) => {
  try {
    const { icon, name, description, tags } = req.body;

    if (!name) return res.status(400).json({ error: 'Name is required.' });
    if (name.length > 255) return res.status(400).json({ error: 'Name must be 255 characters or fewer.' });
    if (description && description.length > 1000) return res.status(400).json({ error: 'Description must be 1000 characters or fewer.' });
    // tags is a comma-separated string e.g. "Free,Outdoors,Equipment provided"
    if (tags && tags.length > 500) return res.status(400).json({ error: 'Tags must be 500 characters or fewer.' });

    const item = await activityListService.create({ icon, name, description, tags });
    res.status(201).json(item);
  } catch (err) { next(err); }
});

// DELETE /api/activity-items/:id — admin only, remove an activity
router.delete('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID.' });
    const deleted = await activityListService.delete(id);
    if (!deleted) return res.status(404).json({ error: 'Activity not found.' });
    res.json({ message: 'Activity deleted.' });
  } catch (err) { next(err); }
});

module.exports = router;
