const express = require('express');
const { barService } = require('../services/index');
const { requireRole } = require('../middleware/auth');
const { ROLES } = require('../constants');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    res.json(await barService.getAll());
  } catch (err) { next(err); }
});

router.post('/', requireRole(ROLES.ADMIN), async (req, res, next) => {
  try {
    const { category, name, description, price } = req.body;

    if (!category || !name) return res.status(400).json({ error: 'Category and name are required.' });
    if (category.length > 100)    return res.status(400).json({ error: 'Category must be 100 characters or fewer.' });
    if (name.length > 255)        return res.status(400).json({ error: 'Name must be 255 characters or fewer.' });
    if (description?.length > 500) return res.status(400).json({ error: 'Description must be 500 characters or fewer.' });
    if (price != null && (isNaN(Number(price)) || Number(price) < 0)) {
      return res.status(400).json({ error: 'Price must be a positive number.' });
    }

    res.status(201).json(await barService.create({ category, name, description, price }));
  } catch (err) { next(err); }
});

router.delete('/:id', requireRole(ROLES.ADMIN), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID.' });
    const deleted = await barService.delete(id);
    if (!deleted) return res.status(404).json({ error: 'Item not found.' });
    res.json({ message: 'Item deleted.' });
  } catch (err) { next(err); }
});

module.exports = router;
