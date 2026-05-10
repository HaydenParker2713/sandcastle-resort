const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { pool } = require('../config/db');
const { ValidationError, ConflictError } = require('../errors');

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

  async getUserById(user_id) {
    const [rows] = await pool.execute(
      `SELECT u.user_id, u.first_name, u.last_name, u.email, r.role_name
       FROM users u JOIN roles r ON u.role_id = r.role_id
       WHERE u.user_id = ?`,
      [user_id]
    );
    return rows[0] || null;
  },

  async updateUserRole(user_id, role_name) {
    const [roles] = await pool.execute(`SELECT role_id FROM roles WHERE role_name = ?`, [role_name]);
    if (!roles.length) {
      throw new ValidationError('Invalid role.', 'INVALID_ROLE');
    }
    await pool.execute(`UPDATE users SET role_id = ? WHERE user_id = ?`, [roles[0].role_id, user_id]);
  },

  async createPasswordResetToken(email) {
    const [rows] = await pool.execute(
      `SELECT user_id, first_name, email FROM users WHERE email = ?`,
      [email]
    );
    if (!rows.length) return null;

    const token     = crypto.randomUUID();
    const expiryStr = new Date(Date.now() + 60 * 60 * 1000)
      .toISOString().slice(0, 19).replace('T', ' ');

    await pool.execute(
      `UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE user_id = ?`,
      [token, expiryStr, rows[0].user_id]
    );
    return { token, user: rows[0] };
  },

  async resetPasswordByToken(token, newPassword) {
    // Hash first — bcrypt is slow and must not run inside a row lock.
    const hash = await bcrypt.hash(newPassword, 10);

    // Single atomic UPDATE: matches only if the token exists and has not expired.
    // Clears the token in the same statement, so a second concurrent request with
    // the same token finds reset_token = NULL and gets affectedRows = 0.
    const [result] = await pool.execute(
      `UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expiry = NULL
       WHERE reset_token = ? AND reset_token_expiry > NOW()`,
      [hash, token]
    );

    if (result.affectedRows === 0) {
      throw new ValidationError('Reset link is invalid or has expired.', 'INVALID_TOKEN');
    }
  },

  async updateProfile(user_id, { first_name, last_name, email }) {
    const [existing] = await pool.execute(
      `SELECT user_id FROM users WHERE email = ? AND user_id != ?`, [email, user_id]
    );
    if (existing.length) {
      throw new ConflictError('Email is already in use by another account.', 'EMAIL_TAKEN');
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
  },
};

module.exports = authService;
