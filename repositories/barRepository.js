const { pool } = require('../config/db');

const barRepository = {
  async findAll() {
    const [rows] = await pool.execute(
      `SELECT * FROM bar_items ORDER BY category, sort_order, item_id`
    );
    return rows;
  },

  async insert({ category, name, description, price }) {
    const [result] = await pool.execute(
      `INSERT INTO bar_items (category, name, description, price) VALUES (?, ?, ?, ?)`,
      [category, name, description || null, price != null ? price : null]
    );
    const [rows] = await pool.execute(`SELECT * FROM bar_items WHERE item_id = ?`, [result.insertId]);
    return rows[0];
  },

  async delete(item_id) {
    const [result] = await pool.execute(
      `DELETE FROM bar_items WHERE item_id = ?`,
      [item_id]
    );
    return result.affectedRows > 0;
  },
};

module.exports = barRepository;
