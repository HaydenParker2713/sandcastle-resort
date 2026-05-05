const { pool } = require('../config/db');

const reviewService = {
  async createReview({ reservation_id, user_id, unit_id, rating, comment }) {
    const [result] = await pool.execute(
      `INSERT INTO reviews (reservation_id, user_id, unit_id, rating, comment)
       VALUES (?, ?, ?, ?, ?)`,
      [reservation_id, user_id, unit_id, rating, comment || null]
    );
    return result.insertId;
  },

  async getReviewByReservation(reservation_id) {
    const [rows] = await pool.execute(
      `SELECT review_id, rating, comment, created_at FROM reviews WHERE reservation_id = ?`,
      [reservation_id]
    );
    return rows[0] || null;
  },

  async getReviewsByUnit(unit_id) {
    const [rows] = await pool.execute(
      `SELECT rv.rating, rv.comment, rv.created_at, u.first_name, u.last_name
       FROM reviews rv
       JOIN users u ON rv.user_id = u.user_id
       WHERE rv.unit_id = ?
       ORDER BY rv.created_at DESC`,
      [unit_id]
    );
    return rows;
  },

  async getReviewedReservationIds(user_id) {
    const [rows] = await pool.execute(
      `SELECT reservation_id FROM reviews WHERE user_id = ?`,
      [user_id]
    );
    return rows.map(r => r.reservation_id);
  },

  async getAllReviews() {
    const [rows] = await pool.execute(
      `SELECT rv.review_id, rv.rating, rv.comment, rv.created_at,
              u.first_name, u.last_name,
              un.unit_code, ut.type_name
       FROM reviews rv
       JOIN users u ON rv.user_id = u.user_id
       JOIN units un ON rv.unit_id = un.unit_id
       JOIN unit_types ut ON un.unit_type_id = ut.unit_type_id
       ORDER BY rv.created_at DESC`
    );
    return rows;
  },
};

module.exports = reviewService;
