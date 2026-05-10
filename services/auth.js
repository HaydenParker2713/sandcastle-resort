const bcrypt = require('bcrypt');
const crypto = require('crypto');
const userRepo = require('../repositories/userRepository');
const { ValidationError, ConflictError } = require('../errors');

const authService = {
  async findByEmail(email) {
    return userRepo.findByEmail(email);
  },

  async register({ first_name, last_name, email, password }) {
    const passwordHash = await bcrypt.hash(password, 10);
    const insertId = await userRepo.insert({ first_name, last_name, email, passwordHash });
    return userRepo.findById(insertId);
  },

  async verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
  },

  async changePassword(user_id, new_password) {
    const hash = await bcrypt.hash(new_password, 10);
    await userRepo.updatePassword(user_id, hash);
  },

  async getAllUsers() {
    return userRepo.findAll();
  },

  async getUserById(user_id) {
    return userRepo.findById(user_id);
  },

  async updateUserRole(user_id, role_name) {
    const role = await userRepo.findRoleByName(role_name);
    if (!role) throw new ValidationError('Invalid role.', 'INVALID_ROLE');
    await userRepo.updateRole(user_id, role.role_id);
  },

  async createPasswordResetToken(email) {
    const user = await userRepo.findForReset(email);
    if (!user) return null;
    const token     = crypto.randomUUID();
    const expiryStr = new Date(Date.now() + 60 * 60 * 1000)
      .toISOString().slice(0, 19).replace('T', ' ');
    await userRepo.setResetToken(user.user_id, token, expiryStr);
    return { token, user };
  },

  async resetPasswordByToken(token, newPassword) {
    // Hash first — bcrypt is slow and must not run inside a row lock.
    const hash = await bcrypt.hash(newPassword, 10);
    // Single atomic UPDATE: clears the token so a concurrent request finds NULL and gets affectedRows = 0.
    const affected = await userRepo.resetByToken(token, hash);
    if (affected === 0) throw new ValidationError('Reset link is invalid or has expired.', 'INVALID_TOKEN');
  },

  async updateProfile(user_id, { first_name, last_name, email }) {
    const existing = await userRepo.findByEmailExcluding(email, user_id);
    if (existing.length) throw new ConflictError('Email is already in use by another account.', 'EMAIL_TAKEN');
    await userRepo.updateProfile(user_id, { first_name, last_name, email });
    return userRepo.findById(user_id);
  },
};

module.exports = authService;
