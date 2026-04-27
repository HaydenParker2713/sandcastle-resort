const express = require('express');
const { activityListService } = require('../services');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    res.json(await activityListService.getAll());
  } catch (err) {
    console.error('Get activities error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const { icon, name, description, tags } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required.' });
    if (name.length > 255) return res.status(400).json({ error: 'Name must be 255 characters or fewer.' });
    if (description && description.length > 1000) return res.status(400).json({ error: 'Description must be 1000 characters or fewer.' });
    if (tags && tags.length > 500) return res.status(400).json({ error: 'Tags must be 500 characters or fewer.' });
    const item = await activityListService.create({ icon, name, description, tags });
    res.status(201).json(item);
  } catch (err) {
    console.error('Create activity error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID.' });
    await activityListService.delete(id);
    res.json({ message: 'Activity deleted.' });
  } catch (err) {
    console.error('Delete activity error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
