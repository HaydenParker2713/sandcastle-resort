const { pool } = require('../config/db');

const ticketService = {
  async createTicket({ unit_id, created_by, ticket_type, title, description }) {
    const [result] = await pool.execute(
      `INSERT INTO tickets (unit_id, created_by, ticket_type, title, description)
       VALUES (?, ?, ?, ?, ?)`,
      [unit_id, created_by, ticket_type, title, description || null]
    );
    return result.insertId;
  },

  async getTicketsByUser(user_id) {
    const [rows] = await pool.execute(
      `SELECT t.ticket_id, t.ticket_type, t.title, t.description, t.status, t.created_at,
              u.unit_code
       FROM tickets t
       JOIN units u ON t.unit_id = u.unit_id
       WHERE t.created_by = ?
       ORDER BY t.created_at DESC`,
      [user_id]
    );
    return rows;
  },

  async getAllTickets() {
    const [rows] = await pool.execute(
      `SELECT t.ticket_id, t.ticket_type, t.title, t.description, t.status,
              t.created_at, t.closed_at,
              u.unit_code,
              usr.first_name, usr.last_name,
              cl.first_name AS closed_by_first, cl.last_name AS closed_by_last
       FROM tickets t
       JOIN units u    ON t.unit_id    = u.unit_id
       JOIN users usr  ON t.created_by = usr.user_id
       LEFT JOIN users cl ON t.closed_by = cl.user_id
       ORDER BY t.created_at DESC`
    );
    return rows;
  },

  async getTicketById(ticket_id) {
    const [rows] = await pool.execute(
      `SELECT t.ticket_id, t.title, t.ticket_type, t.status,
              u.unit_code, usr.first_name, usr.last_name
       FROM tickets t
       JOIN units u   ON t.unit_id    = u.unit_id
       JOIN users usr ON t.created_by = usr.user_id
       WHERE t.ticket_id = ?`,
      [ticket_id]
    );
    return rows[0] || null;
  },

  async updateTicketStatus(ticket_id, status, closed_by_user_id = null) {
    let sql, params;
    if (status === 'closed') {
      sql    = `UPDATE tickets SET status = ?, closed_by = ?, closed_at = NOW() WHERE ticket_id = ?`;
      params = [status, closed_by_user_id, ticket_id];
    } else {
      sql    = `UPDATE tickets SET status = ?, closed_by = NULL, closed_at = NULL WHERE ticket_id = ?`;
      params = [status, ticket_id];
    }
    const [result] = await pool.execute(sql, params);
    return result.affectedRows > 0;
  },
};

module.exports = ticketService;
