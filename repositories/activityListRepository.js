const { pool } = require('../config/db');

const activityListRepository = {
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
