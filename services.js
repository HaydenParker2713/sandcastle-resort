const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { pool } = require('./config/db');

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

  async changePassword(user_id, new_password) {
    const hash = await bcrypt.hash(new_password, 10);
    await pool.execute('UPDATE users SET password_hash = ? WHERE user_id = ?', [hash, user_id]);
  },

  async getAllUsers() {
    const [rows] = await pool.execute(
      `SELECT u.user_id, u.first_name, u.last_name, u.email, r.role_name, u.created_at
       FROM users u JOIN roles r ON u.role_id = r.role_id
       ORDER BY u.created_at DESC`
    );
    return rows;
  },

  async updateUserRole(user_id, role_name) {
    const [roles] = await pool.execute(`SELECT role_id FROM roles WHERE role_name = ?`, [role_name]);
    if (!roles.length) {
      const err = new Error('Invalid role.');
      err.code = 'INVALID_ROLE';
      throw err;
    }
    await pool.execute(`UPDATE users SET role_id = ? WHERE user_id = ?`, [roles[0].role_id, user_id]);
  },

  async createPasswordResetToken(email) {
    const [rows] = await pool.execute(
      `SELECT user_id, first_name, email FROM users WHERE email = ?`,
      [email]
    );
    if (!rows.length) return null;

    const token  = crypto.randomUUID();
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    const expiryStr = expiry.toISOString().slice(0, 19).replace('T', ' ');

    await pool.execute(
      `UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE user_id = ?`,
      [token, expiryStr, rows[0].user_id]
    );
    return { token, user: rows[0] };
  },

  async validateResetToken(token) {
    const [rows] = await pool.execute(
      `SELECT user_id, first_name, email FROM users
       WHERE reset_token = ? AND reset_token_expiry > NOW()`,
      [token]
    );
    return rows[0] || null;
  },

  async resetPasswordByToken(token, newPassword) {
    const user = await this.validateResetToken(token);
    if (!user) {
      const err = new Error('Reset link is invalid or has expired.');
      err.code = 'INVALID_TOKEN';
      throw err;
    }
    const hash = await bcrypt.hash(newPassword, 10);
    await pool.execute(
      `UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expiry = NULL
       WHERE user_id = ?`,
      [hash, user.user_id]
    );
    return user;
  },

  async updateProfile(user_id, { first_name, last_name, email }) {
    const [existing] = await pool.execute(
      `SELECT user_id FROM users WHERE email = ? AND user_id != ?`, [email, user_id]
    );
    if (existing.length) {
      const err = new Error('Email is already in use by another account.');
      err.code = 'EMAIL_TAKEN';
      throw err;
    }
    await pool.execute(
      `UPDATE users SET first_name = ?, last_name = ?, email = ? WHERE user_id = ?`,
      [first_name, last_name, email, user_id]
    );
    const [rows] = await pool.execute(
      `SELECT u.user_id, u.first_name, u.last_name, u.email, r.role_name
       FROM users u JOIN roles r ON u.role_id = r.role_id WHERE u.user_id = ?`,
      [user_id]
    );
    return rows[0];
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
      `SELECT reservation_id, unit_id FROM reservations WHERE reservation_id = ? AND user_id = ?`,
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
  }
};

const statsService = {
  async getAdminStats() {
    const [[revenue]] = await pool.execute(
      `SELECT COALESCE(SUM(total_amount),0) AS total_revenue,
              COUNT(*) AS total_invoices
       FROM invoices WHERE status = 'paid'`
    );
    const [monthly] = await pool.execute(
      `SELECT DATE_FORMAT(i.created_at, '%Y-%m') AS month,
              COALESCE(SUM(i.total_amount),0) AS revenue,
              COUNT(*) AS bookings
       FROM invoices i
       JOIN reservations r ON i.reservation_id = r.reservation_id
       WHERE r.status = 'confirmed'
         AND i.created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
       GROUP BY month
       ORDER BY month ASC`
    );
    const [[avgRating]] = await pool.execute(
      `SELECT ROUND(AVG(rating),1) AS avg_rating, COUNT(*) AS total_reviews FROM reviews`
    );
    return { revenue, monthly, avgRating };
  }
};

const barService = {
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
  async getAll() {
    const [rows] = await pool.execute(
      `SELECT * FROM bar_items ORDER BY category, sort_order, item_id`
    );
    return rows;
  },
  async create({ category, name, description, price }) {
    const [result] = await pool.execute(
      `INSERT INTO bar_items (category, name, description, price) VALUES (?, ?, ?, ?)`,
      [category, name, description || null, price != null ? price : null]
    );
    const [rows] = await pool.execute(`SELECT * FROM bar_items WHERE item_id = ?`, [result.insertId]);
    return rows[0];
  },
  async delete(item_id) {
    await pool.execute(`DELETE FROM bar_items WHERE item_id = ?`, [item_id]);
  }
};

const activityListService = {
  async ensureTable() {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS resort_activities (
        activity_id INT AUTO_INCREMENT PRIMARY KEY,
        icon        VARCHAR(10)  DEFAULT '🏄',
        name        VARCHAR(255) NOT NULL,
        description TEXT,
        tags        VARCHAR(500) DEFAULT NULL,
        sort_order  INT DEFAULT 0,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  },
  async getAll() {
    const [rows] = await pool.execute(
      `SELECT * FROM resort_activities ORDER BY sort_order, activity_id`
    );
    return rows;
  },
  async create({ icon, name, description, tags }) {
    const [result] = await pool.execute(
      `INSERT INTO resort_activities (icon, name, description, tags) VALUES (?, ?, ?, ?)`,
      [icon || '🏄', name, description || null, tags || null]
    );
    const [rows] = await pool.execute(`SELECT * FROM resort_activities WHERE activity_id = ?`, [result.insertId]);
    return rows[0];
  },
  async delete(activity_id) {
    await pool.execute(`DELETE FROM resort_activities WHERE activity_id = ?`, [activity_id]);
  }
};

const eventService = {
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

  async getAll() {
    const [rows] = await pool.execute(
      `SELECT e.event_id, e.title, e.description, e.event_date, e.event_time,
              e.location, e.ticket_info, e.banner_emoji, e.image_path, e.created_at,
              u.first_name, u.last_name
       FROM events e
       LEFT JOIN users u ON e.created_by = u.user_id
       ORDER BY e.event_date ASC, e.created_at ASC`
    );
    return rows;
  },

  async create({ title, description, event_date, event_time, location, ticket_info, banner_emoji, image_path, created_by }) {
    const [result] = await pool.execute(
      `INSERT INTO events (title, description, event_date, event_time, location, ticket_info, banner_emoji, image_path, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, description || null, event_date || null, event_time || null, location || null, ticket_info || null, banner_emoji || '🎉', image_path || null, created_by]
    );
    const [rows] = await pool.execute(`SELECT * FROM events WHERE event_id = ?`, [result.insertId]);
    return rows[0];
  },

  async delete(event_id) {
    const [rows] = await pool.execute(`SELECT image_path FROM events WHERE event_id = ?`, [event_id]);
    await pool.execute(`DELETE FROM events WHERE event_id = ?`, [event_id]);
    return rows[0]?.image_path || null;
  }
};

module.exports = {
  unitService,
  authService,
  reservationService,
  invoiceService,
  ticketService,
  reviewService,
  statsService,
  eventService,
  barService,
  activityListService
};