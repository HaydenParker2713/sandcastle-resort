const activityListRepo = require('../repositories/activityListRepository');

const activityListService = {
  async ensureTable() {
    return activityListRepo.ensureTable();
  },

  async getAll() {
    return activityListRepo.findAll();
  },

  async create(data) {
    return activityListRepo.insert(data);
  },

  async delete(activity_id) {
    return activityListRepo.delete(activity_id);
  },
};

module.exports = activityListService;
