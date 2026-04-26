const bcrypt = require('bcrypt');

module.exports = (pool) => {
  const unitService = {
    async getAllUnits() {
      const [rows] = await pool.execute(
        `SELECT 
            u.unit_id,
            u.unit_code,
            u.status,
            ut.type_name,
            ut.capacity,
            ut.nightly_rate
         FROM units u
         JOIN unit_types ut ON u.unit_type_id = ut.unit_type_id
         ORDER BY u.unit_code`
      );
      return rows;
    },

    async createUnit(unit_type_id, unit_code, status = 'available') {
      const [result] = await pool.execute(
        `INSERT INTO units (unit_type_id, unit_code, status)
         VALUES (?, ?, ?)`,
        [unit_type_id, unit_code, status]
      );
      return result.insertId;
    }
  };

  const authService = {
    async findByEmail(email) {
      const [rows] = await pool.execute(
        `SELECT u.user_id, u.first_name, u.last_name, u.email, u.password_hash, r.role_name
         FROM users u
         JOIN roles r ON u.role_id = r.role_id
         WHERE u.email = ?`,
        [email]
      );
      return rows[0] || null;
    },

    async register({ first_name, last_name, email, password }) {
      const passwordHash = await bcrypt.hash(password, 10);

      const [result] = await pool.execute(
        `INSERT INTO users (role_id, first_name, last_name, email, password_hash)
         VALUES (?, ?, ?, ?, ?)`,
        [1, first_name, last_name, email, passwordHash]
      );

      const [rows] = await pool.execute(
        `SELECT u.user_id, u.first_name, u.last_name, u.email, r.role_name
         FROM users u
         JOIN roles r ON u.role_id = r.role_id
         WHERE u.user_id = ?`,
        [result.insertId]
      );

      return rows[0];
    },

    async verifyPassword(password, hash) {
      return bcrypt.compare(password, hash);
    }
  };

  const reservationService = {
    async createReservation({ user_id, unit_id, check_in, check_out, adults = 1, children = 0 }) {
      const [result] = await pool.execute(
        `INSERT INTO reservations (user_id, unit_id, check_in, check_out, adults, children)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [user_id, unit_id, check_in, check_out, adults, children]
      );
      return result.insertId;
    },

    async getReservationsByUser(user_id) {
      const [rows] = await pool.execute(
        `SELECT r.reservation_id, r.check_in, r.check_out, r.adults, r.children, r.status,
                u.unit_code, ut.type_name, ut.nightly_rate
         FROM reservations r
         JOIN units u ON r.unit_id = u.unit_id
         JOIN unit_types ut ON u.unit_type_id = ut.unit_type_id
         WHERE r.user_id = ? AND r.status = 'confirmed'
         ORDER BY r.check_in DESC`,
        [user_id]
      );
      return rows;
    },

    async cancelReservation(reservation_id, user_id, isAdmin = false) {
      // If not admin, ensure reservation belongs to user
      if (!isAdmin) {
        const [rows] = await pool.execute(
          `SELECT reservation_id FROM reservations WHERE reservation_id = ? AND user_id = ?`,
          [reservation_id, user_id]
        );
        if (rows.length === 0) {
          const err = new Error('Not found or not allowed');
          err.code = 'NOT_ALLOWED';
          throw err;
        }
      }

      const [result] = await pool.execute(
        `UPDATE reservations SET status = 'cancelled' WHERE reservation_id = ?`,
        [reservation_id]
      );

      return result.affectedRows > 0;
    }
  };

  return { unitService, authService, reservationService };
};