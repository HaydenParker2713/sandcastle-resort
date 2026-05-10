const { pool } = require('../config/db');

async function logAction(actorId, actorName, action, targetType, targetId, detail = null) {
  try {
    await pool.execute(
      `INSERT INTO audit_log (actor_id, actor_name, action, target_type, target_id, detail)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [actorId || null, actorName || null, action, targetType, targetId,
       detail ? JSON.stringify(detail) : null]
    );
  } catch (err) {
    console.error('[audit] Failed to log action:', err.message);
  }
}

module.exports = { logAction };
