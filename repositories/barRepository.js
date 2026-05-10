const { pool } = require('../config/db');

const barRepository = {
  async ensureTable() {
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
  },

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
