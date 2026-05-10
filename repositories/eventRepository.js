const { pool } = require('../config/db');

const eventRepository = {
  async ensureTable() {
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
  },

  async findAll() {
    const [rows] = await pool.execute(
      `SELECT e.event_id, e.title, e.description, e.event_date, e.event_time,
              e.location, e.ticket_info, e.banner_emoji, e.image_path, e.created_at,
              u.first_name, u.last_name
       FROM events e
       LEFT JOIN users u ON e.created_by = u.user_id
       ORDER BY
         CASE WHEN e.event_date IS NULL      THEN 1
              WHEN e.event_date >= CURDATE() THEN 0
              ELSE 2 END ASC,
         e.event_date ASC,
         e.created_at ASC`
    );
    return rows;
  },

  async insert({ title, description, event_date, event_time, location, ticket_info, banner_emoji, image_path, created_by }) {
    const [result] = await pool.execute(
      `INSERT INTO events
         (title, description, event_date, event_time, location, ticket_info, banner_emoji, image_path, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, description || null, event_date || null, event_time || null,
       location || null, ticket_info || null, banner_emoji || '🎉', image_path || null, created_by]
    );
    const [rows] = await pool.execute(`SELECT * FROM events WHERE event_id = ?`, [result.insertId]);
    return rows[0];
  },

  async findImagePath(event_id) {
    const [rows] = await pool.execute(
      `SELECT image_path FROM events WHERE event_id = ?`,
      [event_id]
    );
    return rows[0] || null;
  },

  async delete(event_id) {
    await pool.execute(`DELETE FROM events WHERE event_id = ?`, [event_id]);
  },
};

module.exports = eventRepository;
