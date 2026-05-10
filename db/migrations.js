const { pool } = require('../config/db');

async function runMigrations() {
  // audit_log — probe before create to keep the common fast path lock-free
  try {
    await pool.execute(`SELECT 1 FROM audit_log LIMIT 1`);
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') {
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
      console.log('[migrations] Created audit_log table');
    }
  }

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS events (
      event_id     INT AUTO_INCREMENT PRIMARY KEY,
      title        VARCHAR(255)  NOT NULL,
      description  TEXT,
      event_date   DATE,
      event_time   VARCHAR(50),
      location     VARCHAR(255),
      ticket_info  VARCHAR(255),
      banner_emoji VARCHAR(10)   DEFAULT '🎉',
      image_path   VARCHAR(500)  DEFAULT NULL,
      created_by   BIGINT UNSIGNED,
      created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS bar_items (
      item_id     INT AUTO_INCREMENT PRIMARY KEY,
      category    VARCHAR(100) NOT NULL,
      name        VARCHAR(255) NOT NULL,
      description TEXT,
      price       DECIMAL(8,2) DEFAULT NULL,
      sort_order  INT DEFAULT 0,
      created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS resort_activities (
      activity_id INT AUTO_INCREMENT PRIMARY KEY,
      icon        VARCHAR(10)  DEFAULT '🏄',
      name        VARCHAR(255) NOT NULL,
      description TEXT,
      tags        VARCHAR(500) DEFAULT NULL,
      sort_order  INT DEFAULT 0,
      created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Optional columns added after initial schema — idempotent, safe every boot
  const conn = await pool.getConnection();
  try {
    const [typeCols] = await conn.execute(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'unit_types'
         AND COLUMN_NAME IN ('description','amenities','photo_url')`
    );
    const existingType = new Set(typeCols.map(c => c.COLUMN_NAME));
    if (!existingType.has('description')) await conn.execute(`ALTER TABLE unit_types ADD COLUMN description VARCHAR(2000) NULL AFTER nightly_rate`);
    if (!existingType.has('amenities'))   await conn.execute(`ALTER TABLE unit_types ADD COLUMN amenities   VARCHAR(2000) NULL AFTER description`);
    if (!existingType.has('photo_url'))   await conn.execute(`ALTER TABLE unit_types ADD COLUMN photo_url   VARCHAR(500)  NULL AFTER amenities`);

    const [unitCols] = await conn.execute(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'units'
         AND COLUMN_NAME IN ('description','photo_url','nightly_rate')`
    );
    const existingUnit = new Set(unitCols.map(c => c.COLUMN_NAME));
    if (!existingUnit.has('description'))  await conn.execute(`ALTER TABLE units ADD COLUMN description   VARCHAR(2000) NULL`);
    if (!existingUnit.has('photo_url'))    await conn.execute(`ALTER TABLE units ADD COLUMN photo_url     VARCHAR(500)  NULL`);
    if (!existingUnit.has('nightly_rate')) await conn.execute(`ALTER TABLE units ADD COLUMN nightly_rate  DECIMAL(10,2) NULL`);
  } finally {
    conn.release();
  }
}

module.exports = { runMigrations };
