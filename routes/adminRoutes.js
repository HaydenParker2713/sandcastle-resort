const express = require('express');
const { userService, statsService, reviewService } = require('../services/index');
const { requireRole } = require('../middleware/auth');
const { pool } = require('../config/db');
const { logAction } = require('../utils/audit');
const { ROLES } = require('../constants');

const router = express.Router();

// Health check for this route file (no auth required)
router.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Admin routes updated 2024' });
});

router.get('/users', requireRole(ROLES.ADMIN), async (req, res, next) => {
  try {
    res.json(await userService.getAllUsers());
  } catch (err) { next(err); }
});

router.patch('/users/:id/role', requireRole(ROLES.ADMIN), async (req, res, next) => {
  try {
    const target_id = parseInt(req.params.id, 10);
    if (isNaN(target_id)) return res.status(400).json({ error: 'Invalid user ID.' });

    if (target_id === req.session.user.user_id) {
      return res.status(403).json({ error: 'You cannot change your own role.' });
    }

    const { role_name } = req.body;
    if (!role_name) return res.status(400).json({ error: 'role_name is required.' });

    // Single indexed lookup instead of loading every user and doing a JS .find().
    const target = await userService.getUserById(target_id);
    if (!target) return res.status(404).json({ error: 'User not found.' });
    if (target.role_name === ROLES.ADMIN) {
      return res.status(403).json({ error: 'Cannot change the role of an admin account.' });
    }

    await userService.updateUserRole(target_id, role_name);
    const actor = req.session.user;
    logAction(actor.user_id, `${actor.first_name} ${actor.last_name}`,
      'user.role_change', 'user', target_id, {
        target_name:  `${target.first_name} ${target.last_name}`,
        target_email: target.email,
        from:         target.role_name,
        to:           role_name,
      });
    res.json({ message: `Role updated to ${role_name}.` });
  } catch (err) { next(err); }
});

router.get('/stats', requireRole(ROLES.ADMIN), async (req, res, next) => {
  try {
    res.json(await statsService.getAdminStats());
  } catch (err) { next(err); }
});

router.get('/reviews', requireRole(ROLES.ADMIN), async (req, res, next) => {
  try {
    res.json(await reviewService.getAllReviews());
  } catch (err) { next(err); }
});

router.get('/audit-log', requireRole(ROLES.ADMIN), async (req, res, next) => {
  const limit = Math.min(500, Math.max(1, parseInt(req.query.limit) || 200));
  try {
    // pool.query (not execute) avoids a prepared-statement LIMIT parameter bug
    // present in some MySQL/MariaDB versions. `limit` is already a safe integer.
    const [rows] = await pool.query(
      `SELECT log_id, actor_id, actor_name, action, target_type, target_id, detail, created_at
       FROM audit_log ORDER BY created_at DESC LIMIT ${limit}`
    );
    res.json(Array.isArray(rows) ? rows : []);
  } catch (err) { next(err); }
});

module.exports = router;
