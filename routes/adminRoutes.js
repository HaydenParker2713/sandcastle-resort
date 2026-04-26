const express = require('express');
const { pool } = require('../config/db');
const createServices = require('../services');
const { requireRole } = require('../middleware/auth');

const router = express.Router();
const { authService } = createServices(pool);

router.get('/users', requireRole('admin'), async (req, res) => {
  try {
    const users = await authService.getAllUsers();
    res.json(users);
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ error: 'Server error fetching users.' });
  }
});

module.exports = router;
