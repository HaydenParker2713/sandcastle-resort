const { pool } = require('../config/db');

const reservationRepository = {
  // ── Transactional (accept conn) ──────────────────────────────────────────────

  async findUnitForBooking(conn, unit_id) {
    const [rows] = await conn.execute(
      `SELECT u.status, COALESCE(u.nightly_rate, ut.nightly_rate) AS nightly_rate
       FROM units u JOIN unit_types ut ON u.unit_type_id = ut.unit_type_id
       WHERE u.unit_id = ? FOR UPDATE`,
      [unit_id]
    );
    return rows[0] || null;
  },

  async findOverlap(conn, { unit_id, check_in, check_out }) {
    const [rows] = await conn.execute(
      `SELECT reservation_id FROM reservations
       WHERE unit_id = ? AND status = 'confirmed'
       AND check_in < ? AND check_out > ?`,
      [unit_id, check_out, check_in]
    );
    return rows;
  },

  async insertReservation(conn, { user_id, unit_id, check_in, check_out, adults, children }) {
    const [result] = await conn.execute(
      `INSERT INTO reservations (user_id, unit_id, check_in, check_out, adults, children)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [user_id, unit_id, check_in, check_out, adults, children]
    );
    return result.insertId;
  },

  async insertInvoice(conn, { reservation_id, total_amount }) {
    await conn.execute(
      `INSERT INTO invoices (reservation_id, total_amount, status) VALUES (?, ?, 'unpaid')`,
      [reservation_id, total_amount]
    );
  },

  async findForCancel(conn, reservation_id) {
    const [rows] = await conn.execute(
      `SELECT reservation_id, user_id, status FROM reservations WHERE reservation_id = ? FOR UPDATE`,
      [reservation_id]
    );
    return rows[0] || null;
  },

  async cancelReservation(conn, reservation_id) {
    await conn.execute(
      `UPDATE reservations SET status = 'cancelled' WHERE reservation_id = ?`,
      [reservation_id]
    );
  },

  async voidUnpaidInvoice(conn, reservation_id) {
    await conn.execute(
      `UPDATE invoices SET status = 'voided' WHERE reservation_id = ? AND status = 'unpaid'`,
      [reservation_id]
    );
  },

  // ── Non-transactional (use pool) ─────────────────────────────────────────────

  async findById(reservation_id) {
    const [rows] = await pool.execute(
      `SELECT r.reservation_id, r.check_in, r.check_out,
              u.first_name, u.last_name, u.email,
              un.unit_code, ut.type_name,
              i.total_amount
       FROM reservations r
       JOIN users u ON r.user_id = u.user_id
       JOIN units un ON r.unit_id = un.unit_id
       JOIN unit_types ut ON un.unit_type_id = ut.unit_type_id
       LEFT JOIN invoices i ON r.reservation_id = i.reservation_id
       WHERE r.reservation_id = ?`,
      [reservation_id]
    );
    return rows[0] || null;
  },

  async findByUser(user_id) {
    const [rows] = await pool.execute(
      `SELECT r.reservation_id, r.check_in, r.check_out, r.adults, r.children, r.status,
              u.unit_code, ut.type_name,
              COALESCE(u.nightly_rate, ut.nightly_rate) AS nightly_rate
       FROM reservations r
       JOIN units u ON r.unit_id = u.unit_id
       JOIN unit_types ut ON u.unit_type_id = ut.unit_type_id
       WHERE r.user_id = ?
       ORDER BY r.check_in DESC`,
      [user_id]
    );
    return rows;
  },

  async findAll() {
    const [rows] = await pool.execute(
      `SELECT r.reservation_id, r.check_in, r.check_out, r.adults, r.children,
              r.status, r.created_at,
              u.first_name, u.last_name, u.email,
              un.unit_code, ut.type_name, ut.nightly_rate,
              i.invoice_id, i.total_amount, i.status AS invoice_status
       FROM reservations r
       JOIN users u ON r.user_id = u.user_id
       JOIN units un ON r.unit_id = un.unit_id
       JOIN unit_types ut ON un.unit_type_id = ut.unit_type_id
       LEFT JOIN invoices i ON r.reservation_id = i.reservation_id
       ORDER BY r.created_at DESC`
    );
    return rows;
  },

  async findOwner(reservation_id, user_id) {
    const [rows] = await pool.execute(
      `SELECT reservation_id, unit_id, status, check_out
       FROM reservations WHERE reservation_id = ? AND user_id = ?`,
      [reservation_id, user_id]
    );
    return rows[0] || null;
  },

  async hasConfirmedReservationForUnit(user_id, unit_id) {
    const [rows] = await pool.execute(
      `SELECT reservation_id FROM reservations
       WHERE user_id = ? AND unit_id = ? AND status = 'confirmed'
       LIMIT 1`,
      [user_id, unit_id]
    );
    return rows.length > 0;
  },
};

module.exports = reservationRepository;
