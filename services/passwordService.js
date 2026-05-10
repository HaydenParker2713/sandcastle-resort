const bcrypt = require('bcrypt');
const crypto = require('crypto');
const userRepo = require('../repositories/userRepository');
const { ValidationError } = require('../errors');

const passwordService = {
  async changePassword(user_id, new_password) {
    const hash = await bcrypt.hash(new_password, 10);
    await userRepo.updatePassword(user_id, hash);
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
};

module.exports = passwordService;
