const bcrypt = require('bcrypt');

module.exports = (pool) => {
  const unitService = {
    async getAllUnits() {
      const [rows] = await pool.execute(
        `SELECT u.unit_id, u.unit_code, u.status,
                ut.type_name, ut.capacity, ut.nightly_rate
         FROM units u
         JOIN unit_types ut ON u.unit_type_id = ut.unit_type_id
         ORDER BY u.unit_code`
      );
      return rows;
    },

    async createUnit(unit_type_id, unit_code, status = 'available') {
      const [result] = await pool.execute(
        `INSERT INTO units (unit_type_id, unit_code, status) VALUES (?, ?, ?)`,
        [unit_type_id, unit_code, status]
      );
      return result.insertId;
    },

    async updateUnitStatus(unit_id, status) {
      const [result] = await pool.execute(
        `UPDATE units SET status = ? WHERE unit_id = ?`,
        [status, unit_id]
      );
      return result.affectedRows > 0;
    }
  };

  const authService = {
    async findByEmail(email) {
      const [rows] = await pool.execute(
        `SELECT u.user_id, u.first_name, u.last_name, u.email, u.password_hash, r.role_name
         FROM users u JOIN roles r ON u.role_id = r.role_id
         WHERE u.email = ?`,
        [email]
      );
      return rows[0] || null;
    },

    async register({ first_name, last_name, email, password }) {
      const passwordHash = await bcrypt.hash(password, 10);
      const [result] = await pool.execute(
        `INSERT INTO users (role_id, first_name, last_name, email, password_hash) VALUES (1, ?, ?, ?, ?)`,
        [first_name, last_name, email, passwordHash]
      );
      const [rows] = await pool.execute(
        `SELECT u.user_id, u.first_name, u.last_name, u.email, r.role_name
         FROM users u JOIN roles r ON u.role_id = r.role_id
         WHERE u.user_id = ?`,
        [result.insertId]
      );
      return rows[0];
    },

    async verifyPassword(password, hash) {
      return bcrypt.compare(password, hash);
    },

    async getAllUsers() {
      const [rows] = await pool.execute(
        `SELECT u.user_id, u.first_name, u.last_name, u.email, r.role_name, u.created_at
         FROM users u JOIN roles r ON u.role_id = r.role_id
         ORDER BY u.created_at DESC`
      );
      return rows;
    }
  };

  const reservationService = {
    async createReservation({ user_id, unit_id, check_in, check_out, adults = 1, children = 0 }) {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();

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

        const [rateRows] = await conn.execute(
          `SELECT ut.nightly_rate FROM units u
           JOIN unit_types ut ON u.unit_type_id = ut.unit_type_id
           WHERE u.unit_id = ?`,
          [unit_id]
        );
        const nightly_rate = Number(rateRows[0].nightly_rate);
        const nights = Math.round((new Date(check_out) - new Date(check_in)) / 86400000);
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

    async getReservationsByUser(user_id) {
      const [rows] = await pool.execute(
        `SELECT r.reservation_id, r.check_in, r.check_out, r.adults, r.children, r.status,
                u.unit_code, ut.type_name, ut.nightly_rate
         FROM reservations r
         JOIN units u ON r.unit_id = u.unit_id
         JOIN unit_types ut ON u.unit_type_id = ut.unit_type_id
         WHERE r.user_id = ? AND r.status = 'confirmed'
         ORDER BY r.check_in DESC`,
        [user_id]
      );
      return rows;
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
      if (!isAdmin) {
        const [rows] = await pool.execute(
          `SELECT reservation_id FROM reservations WHERE reservation_id = ? AND user_id = ?`,
          [reservation_id, user_id]
        );
        if (rows.length === 0) {
          const err = new Error('Not found or not allowed');
          err.code = 'NOT_ALLOWED';
          throw err;
        }
      }
      const [result] = await pool.execute(
        `UPDATE reservations SET status = 'cancelled' WHERE reservation_id = ?`,
        [reservation_id]
      );
      return result.affectedRows > 0;
    }
  };

  const invoiceService = {
    async getInvoicesByUser(user_id) {
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

    async getAllInvoices() {
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

    async markInvoicePaid(invoice_id) {
      const [result] = await pool.execute(
        `UPDATE invoices SET status = 'paid' WHERE invoice_id = ?`,
        [invoice_id]
      );
      return result.affectedRows > 0;
    }
  };

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
        `SELECT t.ticket_id, t.ticket_type, t.title, t.description, t.status, t.created_at,
                u.unit_code, usr.first_name, usr.last_name
         FROM tickets t
         JOIN units u ON t.unit_id = u.unit_id
         JOIN users usr ON t.created_by = usr.user_id
         ORDER BY t.created_at DESC`
      );
      return rows;
    },

    async updateTicketStatus(ticket_id, status) {
      const [result] = await pool.execute(
        `UPDATE tickets SET status = ? WHERE ticket_id = ?`,
        [status, ticket_id]
      );
      return result.affectedRows > 0;
    }
  };

  return { unitService, authService, reservationService, invoiceService, ticketService };
};
