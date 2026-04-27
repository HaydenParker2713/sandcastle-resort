const express = require('express');
const { barService } = require('../services');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    res.json(await barService.getAll());
  } catch (err) {
    console.error('Get bar items error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const { category, name, description, price } = req.body;
    if (!category || !name) return res.status(400).json({ error: 'Category and name are required.' });
    const item = await barService.create({ category, name, description, price });
    res.status(201).json(item);
  } catch (err) {
    console.error('Create bar item error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID.' });
    await barService.delete(id);
    res.json({ message: 'Item deleted.' });
  } catch (err) {
    console.error('Delete bar item error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
