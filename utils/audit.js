const { pool } = require('../config/db');

async function ensureAuditTable() {
  try {
    // First try to query the table to see if it exists
    await pool.execute(`SELECT 1 FROM audit_log LIMIT 1`);
  } catch (err) {
    // Table doesn't exist, create it
    if (err.code === 'ER_NO_SUCH_TABLE') {
      try {
        await pool.execute(`
          CREATE TABLE IF NOT EXISTS audit_log (
            log_id      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            actor_id    BIGINT UNSIGNED,
            actor_name  VARCHAR(101),
            action      VARCHAR(60) NOT NULL,
            target_type VARCHAR(30) NOT NULL,
            target_id   BIGINT UNSIGNED NOT NULL,
            detail      JSON,
            created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_audit_actor      (actor_id),
            INDEX idx_audit_target     (target_type, target_id),
            INDEX idx_audit_created_at (created_at)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('[audit] Created audit_log table');
      } catch (createErr) {
        console.error('[audit] Failed to create audit_log table:', createErr.message);
        // Still don't throw - let the query handler deal with it
      }
    } else {
      console.error('[audit] Error checking audit_log table:', err.message);
    }
  }
}

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

module.exports = { ensureAuditTable, logAction };
