const { pool } = require('../config/db');

const activityListRepository = {
  async ensureTable() {
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
  },

  async findAll() {
    const [rows] = await pool.execute(
      `SELECT * FROM resort_activities ORDER BY sort_order, activity_id`
    );
    return rows;
  },

  async insert({ icon, name, description, tags }) {
    const [result] = await pool.execute(
      `INSERT INTO resort_activities (icon, name, description, tags) VALUES (?, ?, ?, ?)`,
      [icon || '🏄', name, description || null, tags || null]
    );
    const [rows] = await pool.execute(
      `SELECT * FROM resort_activities WHERE activity_id = ?`,
      [result.insertId]
    );
    return rows[0];
  },

  async delete(activity_id) {
    const [result] = await pool.execute(
      `DELETE FROM resort_activities WHERE activity_id = ?`,
      [activity_id]
    );
    return result.affectedRows > 0;
  },
};

module.exports = activityListRepository;
