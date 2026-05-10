const { pool } = require('../config/db');

const eventRepository = {
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
