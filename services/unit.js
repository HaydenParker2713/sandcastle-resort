const unitRepo = require('../repositories/unitRepository');
const { ConflictError } = require('../errors');

const unitService = {
  async getAllUnits() {
    try {
      return await unitRepo.findAll();
    } catch (err) {
      if (err.code === 'ER_BAD_FIELD_ERROR') {
        await unitRepo.ensureColumns();
        return unitRepo.findAll();
      }
      throw err;
    }
  },

  async getAllUnitTypes() {
    try {
      return await unitRepo.findAllTypes();
    } catch (err) {
      if (err.code === 'ER_BAD_FIELD_ERROR') {
        try {
          await unitRepo.ensureColumns();
          return unitRepo.findAllTypes();
        } catch {
          // Fall back to core columns only if ensureColumns itself fails
          const { pool } = require('../config/db');
          const [rows] = await pool.execute(
            `SELECT unit_type_id, type_name, capacity, nightly_rate,
                    NULL AS description, NULL AS amenities, NULL AS photo_url
             FROM unit_types ORDER BY type_name`
          );
          return rows;
        }
      }
      throw err;
    }
  },

  async getUnitById(unit_id) {
    return unitRepo.findById(unit_id);
  },

  async getUnitTypeById(unit_type_id) {
    return unitRepo.findTypeById(unit_type_id);
  },

  async createUnit(unit_type_id, unit_code, status) {
    return unitRepo.insert(unit_type_id, unit_code, status);
  },

  async updateUnitStatus(unit_id, status) {
    return unitRepo.updateStatus(unit_id, status);
  },

  async updateUnitDetails(unit_id, updates) {
    return unitRepo.updateDetails(unit_id, updates);
  },

  async updateUnitTypeDetails(unit_type_id, updates) {
    return unitRepo.updateTypeDetails(unit_type_id, updates);
  },

  async deleteUnit(unit_id) {
    const hasActive = await unitRepo.hasActiveReservations(unit_id);
    if (hasActive) throw new ConflictError('Cannot delete a unit with active reservations.', 'HAS_RESERVATIONS');
    return unitRepo.delete(unit_id);
  },

  async getUnitAvailability(unit_id) {
    return unitRepo.findAvailability(unit_id);
  },

};

module.exports = unitService;
