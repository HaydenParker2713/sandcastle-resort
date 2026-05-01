// ── Bar & Dining routes  /api/bar ─────────────────────────────────────────────
// Menu items for the resort bar. Publicly readable; admin-only for changes.

const express = require('express');
const { barService } = require('../services');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/bar — public endpoint, returns all bar items ordered by category
router.get('/', async (req, res) => {
  try {
    res.json(await barService.getAll());
  } catch (err) {
    console.error('Get bar items error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/bar — admin only, add a new menu item
router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const { category, name, description, price } = req.body;

    // category and name are the only required fields
    if (!category || !name) return res.status(400).json({ error: 'Category and name are required.' });
    if (category.length > 100) return res.status(400).json({ error: 'Category must be 100 characters or fewer.' });
    if (name.length > 255)     return res.status(400).json({ error: 'Name must be 255 characters or fewer.' });
    if (description && description.length > 500) return res.status(400).json({ error: 'Description must be 500 characters or fewer.' });
    // Price is optional (some items may be complimentary), but if provided must be a positive number
    if (price != null && (isNaN(Number(price)) || Number(price) < 0)) return res.status(400).json({ error: 'Price must be a positive number.' });

    const item = await barService.create({ category, name, description, price });
    res.status(201).json(item);
  } catch (err) {
    console.error('Create bar item error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// DELETE /api/bar/:id — admin only, remove a menu item
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
