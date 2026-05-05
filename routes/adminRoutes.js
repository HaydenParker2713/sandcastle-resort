const express = require('express');
const { authService, statsService, reviewService } = require('../services');
const { requireRole } = require('../middleware/auth');
const { pool } = require('../config/db');
const { logAction } = require('../utils/audit');

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
    const actor = req.session.user;
    logAction(actor.user_id, `${actor.first_name} ${actor.last_name}`,
      'user.role_change', 'user', target_id,
      {
        target_name:  `${target.first_name} ${target.last_name}`,
        target_email: target.email,
        from:         target.role_name,
        to:           role_name
      });
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

router.get('/audit-log', requireRole('admin'), async (req, res) => {
  try {
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit) || 200));
    const [rows] = await pool.execute(
      `SELECT log_id, actor_id, actor_name, action, target_type, target_id, detail, created_at
       FROM audit_log ORDER BY created_at DESC LIMIT ?`,
      [limit]
    );
    res.json(rows);
  } catch (err) {
    console.error('Audit log error:', err);
    if (err.code === 'ER_NO_SUCH_TABLE') return res.json([]);
    res.status(500).json({ error: 'Server error fetching audit log.' });
  }
});

module.exports = router;