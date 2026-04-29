// ── services.js ───────────────────────────────────────────────────────────────
// All database logic lives here, organised into service objects — one per
// feature area. Route handlers call these functions so DB queries stay out of
// the route files and can be reused or tested independently.
//
// Every query uses parameterised placeholders (?) so user input is never
// interpolated directly into SQL — this prevents SQL injection.

const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { pool } = require('./config/db'); // shared MySQL connection pool

// ── unitService ──────────────────────────────────────────────────────────────
// Manages the physical accommodation units (rooms, suites, etc.)
const unitService = {
  // Returns all units with effective rate (per-unit overrides type rate when set)
  // and both unit-level and type-level display fields.
  async getAllUnits() {
    const [rows] = await pool.execute(
      `SELECT u.unit_id, u.unit_code, u.status,
              ut.unit_type_id, ut.type_name, ut.capacity,
              COALESCE(u.nightly_rate, ut.nightly_rate) AS nightly_rate,
              u.nightly_rate   AS unit_nightly_rate,
              ut.nightly_rate  AS type_nightly_rate,
              u.description    AS unit_description,
              u.photo_url      AS unit_photo_url,
              ut.description   AS type_description,
              ut.amenities     AS type_amenities,
              ut.photo_url     AS type_photo_url
       FROM units u
       JOIN unit_types ut ON u.unit_type_id = ut.unit_type_id
       ORDER BY u.unit_code`
    );
    return rows;
  },

  async updateUnitDetails(unit_id, updates) {
    const allowed = ['unit_code', 'unit_type_id', 'status', 'description', 'photo_url', 'nightly_rate'];
    const fields  = Object.keys(updates).filter(k => allowed.includes(k));
    if (!fields.length) return false;
    const sql    = `UPDATE units SET ${fields.map(f => `${f} = ?`).join(', ')} WHERE unit_id = ?`;
    const params = [...fields.map(f => updates[f]), unit_id];
    try {
      const [result] = await pool.execute(sql, params);
      return result.affectedRows > 0;
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        const e = new Error('Unit code already in use.');
        e.code = 'DUPLICATE_CODE';
        throw e;
      }
      throw err;
    }
  },

  async deleteUnit(unit_id) {
    const [active] = await pool.execute(
      `SELECT reservation_id FROM reservations WHERE unit_id = ? AND status = 'confirmed' LIMIT 1`,
      [unit_id]
    );
    if (active.length) {
      const err = new Error('Cannot delete a unit with active reservations.');
      err.code = 'HAS_RESERVATIONS';
      throw err;
    }
    const [result] = await pool.execute(`DELETE FROM units WHERE unit_id = ?`, [unit_id]);
    return result.affectedRows > 0;
  },

  // Adds display columns to unit_types and per-unit detail columns to units — safe to call every boot.
  async ensureColumns() {
    const conn = await pool.getConnection();
    try {
      // unit_types display columns
      const [typeCols] = await conn.execute(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'unit_types'
           AND COLUMN_NAME IN ('description','amenities','photo_url')`
      );
      const existingType = new Set(typeCols.map(c => c.COLUMN_NAME));
      if (!existingType.has('description')) await conn.execute(`ALTER TABLE unit_types ADD COLUMN description VARCHAR(2000) NULL AFTER nightly_rate`);
      if (!existingType.has('amenities'))   await conn.execute(`ALTER TABLE unit_types ADD COLUMN amenities   VARCHAR(2000) NULL AFTER description`);
      if (!existingType.has('photo_url'))   await conn.execute(`ALTER TABLE unit_types ADD COLUMN photo_url   VARCHAR(500)  NULL AFTER amenities`);

      // per-unit detail columns
      const [unitCols] = await conn.execute(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'units'
           AND COLUMN_NAME IN ('description','photo_url','nightly_rate')`
      );
      const existingUnit = new Set(unitCols.map(c => c.COLUMN_NAME));
      if (!existingUnit.has('description'))  await conn.execute(`ALTER TABLE units ADD COLUMN description   VARCHAR(2000) NULL`);
      if (!existingUnit.has('photo_url'))    await conn.execute(`ALTER TABLE units ADD COLUMN photo_url     VARCHAR(500)  NULL`);
      if (!existingUnit.has('nightly_rate')) await conn.execute(`ALTER TABLE units ADD COLUMN nightly_rate  DECIMAL(10,2) NULL`);
    } finally {
      conn.release();
    }
  },

  async getAllUnitTypes() {
    const [rows] = await pool.execute(
      `SELECT unit_type_id, type_name, capacity, nightly_rate, description, amenities, photo_url
       FROM unit_types
       ORDER BY type_name`
    );
    return rows;
  },

  async updateUnitTypeDetails(unit_type_id, updates) {
    const allowed = ['description', 'amenities', 'photo_url', 'nightly_rate'];
    const fields  = Object.keys(updates).filter(k => allowed.includes(k));
    if (!fields.length) return false;
    const sql    = `UPDATE unit_types SET ${fields.map(f => `${f} = ?`).join(', ')} WHERE unit_type_id = ?`;
    const params = [...fields.map(f => updates[f]), unit_type_id];
    const [result] = await pool.execute(sql, params);
    return result.affectedRows > 0;
  },

  async createUnit(unit_type_id, unit_code, status = 'available') {
    const [result] = await pool.execute(
      `INSERT INTO units (unit_type_id, unit_code, status) VALUES (?, ?, ?)`,
      [unit_type_id, unit_code, status]
    );
    return result.insertId;
  },

  // Used by admins to mark a unit as available / maintenance / inactive
  async updateUnitStatus(unit_id, status) {
    const [result] = await pool.execute(
      `UPDATE units SET status = ? WHERE unit_id = ?`,
      [status, unit_id]
    );
    return result.affectedRows > 0; // false if no row matched
  },

  // Returns confirmed bookings for a unit — used to render the availability calendar
  async getUnitAvailability(unit_id) {
    const [rows] = await pool.execute(
      `SELECT check_in, check_out FROM reservations WHERE unit_id = ? AND status = 'confirmed'`,
      [unit_id]
    );
    return rows;
  }
};

// ── authService ───────────────────────────────────────────────────────────────
// Handles everything related to user identity: registration, login, password
// management, profile editing, and password reset tokens.
const authService = {
  // Look up a user by email including their hashed password and role.
  // Returns null if not found — callers check for null before comparing passwords.
  async findByEmail(email) {
    const [rows] = await pool.execute(
      `SELECT u.user_id, u.first_name, u.last_name, u.email, u.password_hash, r.role_name
       FROM users u JOIN roles r ON u.role_id = r.role_id
       WHERE u.email = ?`,
      [email]
    );
    return rows[0] || null;
  },

  // Creates a new user with role_id 1 (guest) and a bcrypt hash of their password.
  // bcrypt cost factor 10 means ~100ms per hash — slow enough to frustrate brute-force.
  async register({ first_name, last_name, email, password }) {
    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await pool.execute(
      `INSERT INTO users (role_id, first_name, last_name, email, password_hash) VALUES (1, ?, ?, ?, ?)`,
      [first_name, last_name, email, passwordHash]
    );
    // Re-fetch so we return the same shape as findByEmail (no password_hash)
    const [rows] = await pool.execute(
      `SELECT u.user_id, u.first_name, u.last_name, u.email, r.role_name
       FROM users u JOIN roles r ON u.role_id = r.role_id
       WHERE u.user_id = ?`,
      [result.insertId]
    );
    return rows[0];
  },

  // bcrypt.compare handles the timing-safe comparison — never compare hashes with ===
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

  // Admins can promote/demote a user's role. We look up the role_id by name
  // so the caller only needs to know the readable role name ('guest', 'staff').
  async updateUserRole(user_id, role_name) {
    const [roles] = await pool.execute(`SELECT role_id FROM roles WHERE role_name = ?`, [role_name]);
    if (!roles.length) {
      const err = new Error('Invalid role.');
      err.code = 'INVALID_ROLE';
      throw err;
    }
    await pool.execute(`UPDATE users SET role_id = ? WHERE user_id = ?`, [roles[0].role_id, user_id]);
  },

  // Generates a one-time password-reset token stored on the user row.
  // The token expires in 1 hour. Returns null if the email doesn't exist
  // (but callers should NOT tell the user — doing so leaks whether an
  // email is registered).
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

  // Checks that the token exists AND hasn't expired (compared with DB NOW())
  async validateResetToken(token) {
    const [rows] = await pool.execute(
      `SELECT user_id, first_name, email FROM users
       WHERE reset_token = ? AND reset_token_expiry > NOW()`,
      [token]
    );
    return rows[0] || null;
  },

  // Validates the token, hashes the new password, then clears the token
  // so it cannot be reused.
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

  // Updates name/email for the logged-in user.
  // First checks whether the new email is already used by a different account.
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

// ── reservationService ────────────────────────────────────────────────────────
// Handles booking rooms. The most critical function is createReservation which
// runs inside a DB transaction to prevent double-bookings.
const reservationService = {
  async createReservation({ user_id, unit_id, check_in, check_out, adults = 1, children = 0 }) {
    // Use a dedicated connection so we can wrap everything in a transaction.
    // If anything fails, rollback undoes the partial inserts.
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Check for any existing confirmed reservation on this unit that overlaps.
      // The overlap condition: an existing booking overlaps if it starts before
      // our desired check_out AND ends after our desired check_in.
      const [overlap] = await conn.execute(
        `SELECT reservation_id FROM reservations
         WHERE unit_id = ? AND status = 'confirmed'
         AND check_in < ? AND check_out > ?`,
        [unit_id, check_out, check_in]
      );
      if (overlap.length > 0) {
        const err = new Error('Unit is not available for the selected dates.');
        err.code = 'DOUBLE_BOOKING'; // route handler uses this code to send 409
        throw err;
      }

      // Insert the reservation row
      const [resResult] = await conn.execute(
        `INSERT INTO reservations (user_id, unit_id, check_in, check_out, adults, children)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [user_id, unit_id, check_in, check_out, adults, children]
      );
      const reservation_id = resResult.insertId;

      // Calculate total and auto-create an invoice marked 'unpaid'
      const [rateRows] = await conn.execute(
        `SELECT COALESCE(u.nightly_rate, ut.nightly_rate) AS nightly_rate FROM units u
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
      await conn.rollback(); // undo everything if any step failed
      throw err;
    } finally {
      conn.release(); // always return connection to the pool
    }
  },

  // Fetches only the logged-in user's confirmed reservations (not cancelled ones)
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

  // Returns full booking details including guest info — used to build the
  // confirmation email after creating a reservation
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

  // Confirms that a reservation belongs to the given user (ownership check
  // before allowing reviews or cancellations). Returns status and check_out
  // so callers can verify the stay is complete before accepting a review.
  async getReservationOwner(reservation_id, user_id) {
    const [rows] = await pool.execute(
      `SELECT reservation_id, unit_id, status, check_out
       FROM reservations WHERE reservation_id = ? AND user_id = ?`,
      [reservation_id, user_id]
    );
    return rows[0] || null;
  },

  // Admin/staff view — all reservations with guest and invoice info
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

  // Cancels a reservation. Non-admins can only cancel their own bookings —
  // the ownership check throws NOT_ALLOWED so the route returns 403.
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

// ── invoiceService ────────────────────────────────────────────────────────────
// Invoices are created automatically when a reservation is made (see above).
// The only manual action is marking them paid (done by admin staff).
const invoiceService = {
  // Guest-facing: their own invoices with reservation and unit context
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

  // Admin-facing: all invoices with full guest and unit info
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

// ── ticketService ─────────────────────────────────────────────────────────────
// Support tickets submitted by guests for maintenance or housekeeping issues.
const ticketService = {
  async createTicket({ unit_id, created_by, ticket_type, title, description }) {
    const [result] = await pool.execute(
      `INSERT INTO tickets (unit_id, created_by, ticket_type, title, description)
       VALUES (?, ?, ?, ?, ?)`,
      [unit_id, created_by, ticket_type, title, description || null]
    );
    return result.insertId;
  },

  // Guests only see their own tickets
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

  // Staff/admin see all tickets with reporter and closer names
  async getAllTickets() {
    const [rows] = await pool.execute(
      `SELECT t.ticket_id, t.ticket_type, t.title, t.description, t.status,
              t.created_at, t.closed_at,
              u.unit_code,
              usr.first_name, usr.last_name,
              cl.first_name AS closed_by_first, cl.last_name AS closed_by_last
       FROM tickets t
       JOIN units u    ON t.unit_id   = u.unit_id
       JOIN users usr  ON t.created_by = usr.user_id
       LEFT JOIN users cl ON t.closed_by = cl.user_id
       ORDER BY t.created_at DESC`
    );
    return rows;
  },

  // Staff can change a ticket's status: open → in_progress → closed.
  // When closing, records who closed it and the exact timestamp via MySQL NOW().
  // Re-opening a ticket clears those fields.
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
  }
};

// ── reviewService ─────────────────────────────────────────────────────────────
// Guests can leave one review per completed stay.
const reviewService = {
  async createReview({ reservation_id, user_id, unit_id, rating, comment }) {
    const [result] = await pool.execute(
      `INSERT INTO reviews (reservation_id, user_id, unit_id, rating, comment)
       VALUES (?, ?, ?, ?, ?)`,
      [reservation_id, user_id, unit_id, rating, comment || null]
    );
    return result.insertId;
  },

  // Used to enforce the one-review-per-stay rule before inserting a new review
  async getReviewByReservation(reservation_id) {
    const [rows] = await pool.execute(
      `SELECT review_id, rating, comment, created_at FROM reviews WHERE reservation_id = ?`,
      [reservation_id]
    );
    return rows[0] || null;
  },

  // Public-facing: show reviews on a unit's listing
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

  // Returns an array of reservation_ids the user has already reviewed.
  // Used by the dashboard to decide whether to show a "Leave Review" button.
  async getReviewedReservationIds(user_id) {
    const [rows] = await pool.execute(
      `SELECT reservation_id FROM reviews WHERE user_id = ?`,
      [user_id]
    );
    return rows.map(r => r.reservation_id);
  },

  // Admin view: all reviews with guest name and unit info
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

// ── statsService ──────────────────────────────────────────────────────────────
// Aggregated numbers for the admin revenue dashboard.
const statsService = {
  async getAdminStats() {
    // Total revenue = sum of all paid invoices
    const [[revenue]] = await pool.execute(
      `SELECT COALESCE(SUM(total_amount),0) AS total_revenue,
              COUNT(*) AS total_invoices
       FROM invoices WHERE status = 'paid'`
    );
    // Monthly breakdown for the bar chart (last 6 months, paid invoices only)
    const [monthly] = await pool.execute(
      `SELECT DATE_FORMAT(i.created_at, '%Y-%m') AS month,
              COALESCE(SUM(i.total_amount),0) AS revenue,
              COUNT(*) AS bookings
       FROM invoices i
       JOIN reservations r ON i.reservation_id = r.reservation_id
       WHERE r.status = 'confirmed'
         AND i.status = 'paid'
         AND i.created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
       GROUP BY month
       ORDER BY month ASC`
    );
    // Average star rating across all reviews
    const [[avgRating]] = await pool.execute(
      `SELECT ROUND(AVG(rating),1) AS avg_rating, COUNT(*) AS total_reviews FROM reviews`
    );
    return { revenue, monthly, avgRating };
  }
};

// ── barService ────────────────────────────────────────────────────────────────
// Bar & dining menu items, managed by admin from the admin panel.
// ensureTable() creates the table if it doesn't exist yet — called once on boot.
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
  // Items are ordered by category first (so menu sections group naturally),
  // then by sort_order, then by insertion order as a tiebreaker.
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
    // Re-fetch and return the full row so the API response includes all fields
    const [rows] = await pool.execute(`SELECT * FROM bar_items WHERE item_id = ?`, [result.insertId]);
    return rows[0];
  },
  async delete(item_id) {
    await pool.execute(`DELETE FROM bar_items WHERE item_id = ?`, [item_id]);
  }
};

// ── activityListService ───────────────────────────────────────────────────────
// The list of resort activities shown on the public Activities page.
// Admin-managed — seeded with defaults on first run (see seed.js / server startup).
const activityListService = {
  async ensureTable() {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS resort_activities (
        activity_id INT AUTO_INCREMENT PRIMARY KEY,
        icon        VARCHAR(10)  DEFAULT '🏄',
        name        VARCHAR(255) NOT NULL,
        description TEXT,
        tags        VARCHAR(500) DEFAULT NULL,  -- comma-separated, e.g. "Free,Outdoors"
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

// ── eventService ──────────────────────────────────────────────────────────────
// Resort events posted by staff with optional image upload.
// created_by is BIGINT UNSIGNED to match users.user_id which is also BIGINT UNSIGNED.
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
        image_path   VARCHAR(500)  DEFAULT NULL,  -- relative path under /public
        created_by   BIGINT UNSIGNED,
        created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL
      )
    `);
  },

  // Public endpoint — events ordered soonest first so upcoming events appear at top
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

  // Returns the image_path before deleting so the route handler can
  // delete the uploaded file from disk as well
  async delete(event_id) {
    const [rows] = await pool.execute(`SELECT image_path FROM events WHERE event_id = ?`, [event_id]);
    await pool.execute(`DELETE FROM events WHERE event_id = ?`, [event_id]);
    return rows[0]?.image_path || null;
  }
};

// Export all services so route files can import only what they need
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
