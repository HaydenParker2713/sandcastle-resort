const statsRepo = require('../repositories/statsRepository');

const statsService = {
  async getAdminStats() {
    return statsRepo.getStats();
  },
};

module.exports = statsService;
