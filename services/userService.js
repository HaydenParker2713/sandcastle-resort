const userRepo = require('../repositories/userRepository');
const { ValidationError, ConflictError } = require('../errors');

const userService = {
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

  async updateProfile(user_id, { first_name, last_name, email }) {
    const existing = await userRepo.findByEmailExcluding(email, user_id);
    if (existing.length) throw new ConflictError('Email is already in use by another account.', 'EMAIL_TAKEN');
    await userRepo.updateProfile(user_id, { first_name, last_name, email });
    return userRepo.findById(user_id);
  },
};

module.exports = userService;
