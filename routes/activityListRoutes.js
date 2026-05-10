const express = require('express');
const { activityListService } = require('../services');
const { requireRole } = require('../middleware/auth');
const { ROLES } = require('../constants');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    res.json(await activityListService.getAll());
  } catch (err) { next(err); }
});

router.post('/', requireRole(ROLES.ADMIN), async (req, res, next) => {
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

router.delete('/:id', requireRole(ROLES.ADMIN), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID.' });
    const deleted = await activityListService.delete(id);
    if (!deleted) return res.status(404).json({ error: 'Activity not found.' });
    res.json({ message: 'Activity deleted.' });
  } catch (err) { next(err); }
});

module.exports = router;
