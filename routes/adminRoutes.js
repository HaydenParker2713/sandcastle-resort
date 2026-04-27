const express = require('express');
const { authService, statsService, reviewService } = require('../services');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/users', requireRole('admin'), async (req, res) => {
  try {
    const users = await authService.getAllUsers();
    res.json(users);
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ error: 'Server error fetching users.' });
  }
});

router.patch('/users/:id/role', requireRole('admin'), async (req, res) => {
  try {
    const target_id = parseInt(req.params.id, 10);
    if (isNaN(target_id)) return res.status(400).json({ error: 'Invalid user ID.' });

    const { role_name } = req.body;
    if (!role_name) return res.status(400).json({ error: 'role_name is required.' });

    const users = await authService.getAllUsers();
    const target = users.find(u => u.user_id === target_id);
    if (!target) return res.status(404).json({ error: 'User not found.' });
    if (target.role_name === 'admin') {
      return res.status(403).json({ error: 'Cannot change the role of an admin account.' });
    }

    await authService.updateUserRole(target_id, role_name);
    res.json({ message: `Role updated to ${role_name}.` });
  } catch (err) {
    if (err.code === 'INVALID_ROLE') return res.status(400).json({ error: err.message });
    console.error('Update user role error:', err);
    res.status(500).json({ error: 'Server error updating role.' });
  }
});

router.get('/stats', requireRole('admin'), async (req, res) => {
  try {
    const stats = await statsService.getAdminStats();
    res.json(stats);
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Server error fetching stats.' });
  }
});

router.get('/reviews', requireRole('admin'), async (req, res) => {
  try {
    const reviews = await reviewService.getAllReviews();
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching reviews.' });
  }
});

module.exports = router;