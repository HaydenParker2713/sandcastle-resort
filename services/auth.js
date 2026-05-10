const bcrypt = require('bcrypt');
const userRepo = require('../repositories/userRepository');

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
};

module.exports = authService;
