const { pool } = require('../config/db');

const invoiceRepository = {
  async findByUser(user_id) {
    const [rows] = await pool.execute(
      `SELECT i.invoice_id, i.total_amount, i.status AS invoice_status, i.created_at,
              r.reservation_id, r.check_in, r.check_out, r.status AS reservation_status,
              un.unit_code, ut.type_name
       FROM invoices i
       JOIN reservations r ON i.reservation_id = r.reservation_id
       JOIN units un ON r.unit_id = un.unit_id
       JOIN unit_types ut ON un.unit_type_id = ut.unit_type_id
       WHERE r.user_id = ?
       ORDER BY i.created_at DESC`,
      [user_id]
    );
    return rows;
  },

  async findAll() {
    const [rows] = await pool.execute(
      `SELECT i.invoice_id, i.total_amount, i.status AS invoice_status, i.created_at,
              r.reservation_id, r.check_in, r.check_out, r.status AS reservation_status,
              u.first_name, u.last_name, u.email,
              un.unit_code, ut.type_name
       FROM invoices i
       JOIN reservations r ON i.reservation_id = r.reservation_id
       JOIN users u ON r.user_id = u.user_id
       JOIN units un ON r.unit_id = un.unit_id
       JOIN unit_types ut ON un.unit_type_id = ut.unit_type_id
       ORDER BY i.created_at DESC`
    );
    return rows;
  },

  async markPaid(invoice_id) {
    const [result] = await pool.execute(
      `UPDATE invoices SET status = 'paid' WHERE invoice_id = ? AND status = 'unpaid'`,
      [invoice_id]
    );
    return result.affectedRows > 0;
  },

  async findById(invoice_id) {
    const [rows] = await pool.execute(
      `SELECT i.total_amount, u.first_name, u.last_name, u.email,
              un.unit_code, ut.type_name, r.check_in, r.check_out
       FROM invoices i
       JOIN reservations r ON i.reservation_id = r.reservation_id
       JOIN users u        ON r.user_id = u.user_id
       JOIN units un       ON r.unit_id = un.unit_id
       JOIN unit_types ut  ON un.unit_type_id = ut.unit_type_id
       WHERE i.invoice_id = ?`,
      [invoice_id]
    );
    return rows[0] || null;
  },
};

module.exports = invoiceRepository;
