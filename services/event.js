const eventRepo = require('../repositories/eventRepository');

const eventService = {
  async ensureTable() {
    return eventRepo.ensureTable();
  },

  async getAll() {
    return eventRepo.findAll();
  },

  async create(data) {
    return eventRepo.insert(data);
  },

  async delete(event_id) {
    const row = await eventRepo.findImagePath(event_id);
    if (!row) return { found: false, imagePath: null };
    await eventRepo.delete(event_id);
    return { found: true, imagePath: row.image_path || null };
  },
};

module.exports = eventService;
