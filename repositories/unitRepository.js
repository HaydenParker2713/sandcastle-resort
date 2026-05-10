const { pool } = require('../config/db');
const { ConflictError } = require('../errors');

const unitRepository = {
  async findAll() {
    const sql = `
      SELECT u.unit_id, u.unit_code, u.status,
             ut.unit_type_id, ut.type_name, ut.capacity,
             COALESCE(u.nightly_rate, ut.nightly_rate) AS nightly_rate,
             u.nightly_rate   AS unit_nightly_rate,
             ut.nightly_rate  AS type_nightly_rate,
             u.description    AS unit_description,
             u.photo_url      AS unit_photo_url,
             ut.description   AS type_description,
             ut.amenities     AS type_amenities,
             ut.photo_url     AS type_photo_url
      FROM units u
      JOIN unit_types ut ON u.unit_type_id = ut.unit_type_id
      ORDER BY u.unit_code`;
    const [rows] = await pool.execute(sql);
    return rows;
  },

  async findAllTypes() {
    const [rows] = await pool.execute(
      `SELECT unit_type_id, type_name, capacity, nightly_rate,
              description, amenities, photo_url
       FROM unit_types ORDER BY type_name`
    );
    return rows;
  },

  async findById(unit_id) {
    const [rows] = await pool.execute(
      `SELECT u.unit_id, u.unit_code, u.status, u.photo_url AS unit_photo_url,
              ut.type_name
       FROM units u JOIN unit_types ut ON u.unit_type_id = ut.unit_type_id
       WHERE u.unit_id = ?`,
      [unit_id]
    );
    return rows[0] || null;
  },

  async findTypeById(unit_type_id) {
    const [rows] = await pool.execute(
      `SELECT unit_type_id, type_name, nightly_rate FROM unit_types WHERE unit_type_id = ?`,
      [unit_type_id]
    );
    return rows[0] || null;
  },

  async insert(unit_type_id, unit_code, status) {
    try {
      const [result] = await pool.execute(
        `INSERT INTO units (unit_type_id, unit_code, status) VALUES (?, ?, ?)`,
        [unit_type_id, unit_code, status]
      );
      return result.insertId;
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') throw new ConflictError('Unit code already exists.', 'DUPLICATE_CODE');
      throw err;
    }
  },

  async updateStatus(unit_id, status) {
    const [result] = await pool.execute(
      `UPDATE units SET status = ? WHERE unit_id = ?`,
      [status, unit_id]
    );
    return result.affectedRows > 0;
  },

  async updateDetails(unit_id, updates) {
    const allowed = ['unit_code', 'unit_type_id', 'status', 'description', 'photo_url', 'nightly_rate'];
    const fields  = Object.keys(updates).filter(k => allowed.includes(k));
    if (!fields.length) return false;
    const sql    = `UPDATE units SET ${fields.map(f => `${f} = ?`).join(', ')} WHERE unit_id = ?`;
    const params = [...fields.map(f => updates[f]), unit_id];
    try {
      const [result] = await pool.execute(sql, params);
      return result.affectedRows > 0;
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') throw new ConflictError('Unit code already in use.', 'DUPLICATE_CODE');
      throw err;
    }
  },

  async updateTypeDetails(unit_type_id, updates) {
    const allowed = ['description', 'amenities', 'photo_url', 'nightly_rate'];
    const fields  = Object.keys(updates).filter(k => allowed.includes(k));
    if (!fields.length) return false;
    const sql    = `UPDATE unit_types SET ${fields.map(f => `${f} = ?`).join(', ')} WHERE unit_type_id = ?`;
    const params = [...fields.map(f => updates[f]), unit_type_id];
    const [result] = await pool.execute(sql, params);
    return result.affectedRows > 0;
  },

  async hasActiveReservations(unit_id) {
    const [rows] = await pool.execute(
      `SELECT reservation_id FROM reservations WHERE unit_id = ? AND status = 'confirmed' LIMIT 1`,
      [unit_id]
    );
    return rows.length > 0;
  },

  async delete(unit_id) {
    const [result] = await pool.execute(
      `DELETE FROM units WHERE unit_id = ?`,
      [unit_id]
    );
    return result.affectedRows > 0;
  },

  async findAvailability(unit_id) {
    const [rows] = await pool.execute(
      `SELECT check_in, check_out FROM reservations WHERE unit_id = ? AND status = 'confirmed'`,
      [unit_id]
    );
    return rows;
  },

  async ensureColumns() {
    const conn = await pool.getConnection();
    try {
      const [typeCols] = await conn.execute(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'unit_types'
           AND COLUMN_NAME IN ('description','amenities','photo_url')`
      );
      const existingType = new Set(typeCols.map(c => c.COLUMN_NAME));
      if (!existingType.has('description')) await conn.execute(`ALTER TABLE unit_types ADD COLUMN description VARCHAR(2000) NULL AFTER nightly_rate`);
      if (!existingType.has('amenities'))   await conn.execute(`ALTER TABLE unit_types ADD COLUMN amenities   VARCHAR(2000) NULL AFTER description`);
      if (!existingType.has('photo_url'))   await conn.execute(`ALTER TABLE unit_types ADD COLUMN photo_url   VARCHAR(500)  NULL AFTER amenities`);

      const [unitCols] = await conn.execute(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'units'
           AND COLUMN_NAME IN ('description','photo_url','nightly_rate')`
      );
      const existingUnit = new Set(unitCols.map(c => c.COLUMN_NAME));
      if (!existingUnit.has('description'))  await conn.execute(`ALTER TABLE units ADD COLUMN description   VARCHAR(2000) NULL`);
      if (!existingUnit.has('photo_url'))    await conn.execute(`ALTER TABLE units ADD COLUMN photo_url     VARCHAR(500)  NULL`);
      if (!existingUnit.has('nightly_rate')) await conn.execute(`ALTER TABLE units ADD COLUMN nightly_rate  DECIMAL(10,2) NULL`);
    } finally {
      conn.release();
    }
  },
};

module.exports = unitRepository;
