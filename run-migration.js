require('dotenv').config();
const { pool } = require('./config/db');

async function migrate() {
  const conn = await pool.getConnection();
  try {
    const [cols] = await conn.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tickets'
       AND COLUMN_NAME IN ('closed_by', 'closed_at')`
    );
    const existing = cols.map(r => r.COLUMN_NAME);

    if (existing.includes('closed_by') && existing.includes('closed_at')) {
      console.log('Migration already applied — columns exist.');
      return;
    }

    await conn.query(`
      ALTER TABLE tickets
        ADD COLUMN closed_by BIGINT UNSIGNED NULL AFTER status,
        ADD COLUMN closed_at DATETIME        NULL AFTER closed_by,
        ADD CONSTRAINT fk_ticket_closed_by
          FOREIGN KEY (closed_by) REFERENCES users(user_id)
          ON UPDATE CASCADE ON DELETE SET NULL
    `);
    console.log('Migration applied successfully.');
  } finally {
    conn.release();
    process.exit(0);
  }
}

migrate().catch(err => { console.error('Migration failed:', err.message); process.exit(1); });