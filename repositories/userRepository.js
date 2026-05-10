const { pool } = require('../config/db');

const userRepository = {
  async findByEmail(email) {
    const [rows] = await pool.execute(
      `SELECT u.user_id, u.first_name, u.last_name, u.email, u.password_hash, r.role_name
       FROM users u JOIN roles r ON u.role_id = r.role_id
       WHERE u.email = ?`,
      [email]
    );
    return rows[0] || null;
  },

  async findById(user_id) {
    const [rows] = await pool.execute(
      `SELECT u.user_id, u.first_name, u.last_name, u.email, r.role_name
       FROM users u JOIN roles r ON u.role_id = r.role_id
       WHERE u.user_id = ?`,
      [user_id]
    );
    return rows[0] || null;
  },

  async findAll() {
    const [rows] = await pool.execute(
      `SELECT u.user_id, u.first_name, u.last_name, u.email, r.role_name, u.created_at
       FROM users u JOIN roles r ON u.role_id = r.role_id
       ORDER BY u.created_at DESC`
    );
    return rows;
  },

  async insert({ first_name, last_name, email, passwordHash }) {
    const [result] = await pool.execute(
      `INSERT INTO users (role_id, first_name, last_name, email, password_hash) VALUES (1, ?, ?, ?, ?)`,
      [first_name, last_name, email, passwordHash]
    );
    return result.insertId;
  },

  async updatePassword(user_id, hash) {
    await pool.execute(
      `UPDATE users SET password_hash = ? WHERE user_id = ?`,
      [hash, user_id]
    );
  },

  async findRoleByName(role_name) {
    const [rows] = await pool.execute(
      `SELECT role_id FROM roles WHERE role_name = ?`,
      [role_name]
    );
    return rows[0] || null;
  },

  async updateRole(user_id, role_id) {
    await pool.execute(
      `UPDATE users SET role_id = ? WHERE user_id = ?`,
      [role_id, user_id]
    );
  },

  async findForReset(email) {
    const [rows] = await pool.execute(
      `SELECT user_id, first_name, email FROM users WHERE email = ?`,
      [email]
    );
    return rows[0] || null;
  },

  async setResetToken(user_id, token, expiryStr) {
    await pool.execute(
      `UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE user_id = ?`,
      [token, expiryStr, user_id]
    );
  },

  async resetByToken(token, hash) {
    const [result] = await pool.execute(
      `UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expiry = NULL
       WHERE reset_token = ? AND reset_token_expiry > NOW()`,
      [hash, token]
    );
    return result.affectedRows;
  },

  async findByEmailExcluding(email, user_id) {
    const [rows] = await pool.execute(
      `SELECT user_id FROM users WHERE email = ? AND user_id != ?`,
      [email, user_id]
    );
    return rows;
  },

  async updateProfile(user_id, { first_name, last_name, email }) {
    await pool.execute(
      `UPDATE users SET first_name = ?, last_name = ?, email = ? WHERE user_id = ?`,
      [first_name, last_name, email, user_id]
    );
  },
};

module.exports = userRepository;
