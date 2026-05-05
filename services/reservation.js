const { pool } = require('../config/db');

const reservationService = {
  async createReservation({ user_id, unit_id, check_in, check_out, adults = 1, children = 0 }) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Lock the unit row for the duration of this transaction. FOR UPDATE prevents
      // a concurrent booking from reading status = 'available' on the same row
      // between our check and our INSERT. Also fetches the rate here so we don't
      // need a second round-trip to units after the INSERT.
      const [unitRows] = await conn.execute(
        `SELECT u.status, COALESCE(u.nightly_rate, ut.nightly_rate) AS nightly_rate
         FROM units u JOIN unit_types ut ON u.unit_type_id = ut.unit_type_id
         WHERE u.unit_id = ? FOR UPDATE`,
        [unit_id]
      );
      if (!unitRows.length) {
        const err = new Error('Unit not found.');
        err.code = 'UNIT_NOT_FOUND';
        throw err;
      }
      if (unitRows[0].status !== 'available') {
        const err = new Error('Unit is not available for booking.');
        err.code = 'UNIT_UNAVAILABLE';
        throw err;
      }

      // Overlap check: an existing booking overlaps if it starts before our checkout
      // AND ends after our check-in.
      const [overlap] = await conn.execute(
        `SELECT reservation_id FROM reservations
         WHERE unit_id = ? AND status = 'confirmed'
         AND check_in < ? AND check_out > ?`,
        [unit_id, check_out, check_in]
      );
      if (overlap.length > 0) {
        const err = new Error('Unit is not available for the selected dates.');
        err.code = 'DOUBLE_BOOKING';
        throw err;
      }

      const [resResult] = await conn.execute(
        `INSERT INTO reservations (user_id, unit_id, check_in, check_out, adults, children)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [user_id, unit_id, check_in, check_out, adults, children]
      );
      const reservation_id = resResult.insertId;

      const nightly_rate = Number(unitRows[0].nightly_rate);
      const nights       = Math.round((new Date(check_out) - new Date(check_in)) / 86400000);
      const total_amount = (nights * nightly_rate).toFixed(2);

      await conn.execute(
        `INSERT INTO invoices (reservation_id, total_amount, status) VALUES (?, ?, 'unpaid')`,
        [reservation_id, total_amount]
      );

      await conn.commit();
      return reservation_id;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },

  // Returns all reservations for the user (confirmed + cancelled) with the correct
  // effective nightly rate using the per-unit override when set.
  async getReservationsByUser(user_id) {
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

  async getReservationById(reservation_id) {
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

  async getReservationOwner(reservation_id, user_id) {
    const [rows] = await pool.execute(
      `SELECT reservation_id, unit_id, status, check_out
       FROM reservations WHERE reservation_id = ? AND user_id = ?`,
      [reservation_id, user_id]
    );
    return rows[0] || null;
  },

  async getAllReservations() {
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

  async cancelReservation(reservation_id, user_id, isAdmin = false) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Lock the row for the duration of the transaction so a concurrent cancel
      // cannot read the same status and proceed past the checks below.
      const [rows] = await conn.execute(
        `SELECT reservation_id, user_id, status FROM reservations WHERE reservation_id = ? FOR UPDATE`,
        [reservation_id]
      );

      if (!rows.length) {
        const err = new Error('Reservation not found.');
        err.code = 'NOT_FOUND';
        throw err;
      }

      const reservation = rows[0];

      if (reservation.status === 'cancelled') {
        const err = new Error('Reservation is already cancelled.');
        err.code = 'ALREADY_CANCELLED';
        throw err;
      }

      if (!isAdmin && reservation.user_id !== user_id) {
        const err = new Error('Not found or not allowed.');
        err.code = 'NOT_ALLOWED';
        throw err;
      }

      await conn.execute(
        `UPDATE reservations SET status = 'cancelled' WHERE reservation_id = ?`,
        [reservation_id]
      );

      // Only void invoices that are still unpaid — paid or already-voided invoices are not touched.
      await conn.execute(
        `UPDATE invoices SET status = 'voided' WHERE reservation_id = ? AND status = 'unpaid'`,
        [reservation_id]
      );

      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },
};

module.exports = reservationService;
