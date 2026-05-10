const barRepo = require('../repositories/barRepository');

const barService = {
  async getAll() {
    return barRepo.findAll();
  },

  async create(data) {
    return barRepo.insert(data);
  },

  async delete(item_id) {
    return barRepo.delete(item_id);
  },
};

module.exports = barService;
