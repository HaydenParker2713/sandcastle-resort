const { pool } = require('../config/db');
const reservationRepo = require('../repositories/reservationRepository');
const invoiceRepo     = require('../repositories/invoiceRepository');
const { NotFoundError, ConflictError, ForbiddenError } = require('../errors');

const reservationService = {
  async createReservation({ user_id, unit_id, check_in, check_out, adults = 1, children = 0 }) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const unit = await reservationRepo.findUnitForBooking(conn, unit_id);
      if (!unit) throw new NotFoundError('Unit not found.');
      if (unit.status !== 'available') throw new ConflictError('Unit is not available for booking.', 'UNIT_UNAVAILABLE');

      const overlap = await reservationRepo.findOverlap(conn, { unit_id, check_in, check_out });
      if (overlap.length > 0) throw new ConflictError('Unit is not available for the selected dates.', 'DOUBLE_BOOKING');

      const reservation_id = await reservationRepo.insertReservation(conn, { user_id, unit_id, check_in, check_out, adults, children });

      const nightly_rate = Number(unit.nightly_rate);
      const nights       = Math.round((new Date(check_out) - new Date(check_in)) / 86400000);
      const total_amount = (nights * nightly_rate).toFixed(2);
      await invoiceRepo.insert(conn, { reservation_id, total_amount });

      await conn.commit();
      return reservation_id;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },

  async getReservationsByUser(user_id) {
    return reservationRepo.findByUser(user_id);
  },

  async getReservationById(reservation_id) {
    return reservationRepo.findById(reservation_id);
  },

  async getReservationOwner(reservation_id, user_id) {
    return reservationRepo.findOwner(reservation_id, user_id);
  },

  async getAllReservations() {
    return reservationRepo.findAll();
  },

  async cancelReservation(reservation_id, user_id, isAdmin = false) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const reservation = await reservationRepo.findForCancel(conn, reservation_id);
      if (!reservation) throw new NotFoundError('Reservation not found.');
      if (reservation.status === 'cancelled') throw new ConflictError('Reservation is already cancelled.', 'ALREADY_CANCELLED');
      if (!isAdmin && reservation.user_id !== user_id) throw new ForbiddenError('Not found or not allowed.');

      await reservationRepo.cancelReservation(conn, reservation_id);
      // Only void invoices that are still unpaid — paid or already-voided invoices are not touched.
      await invoiceRepo.voidUnpaid(conn, reservation_id);

      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },

  async hasConfirmedReservationForUnit(user_id, unit_id) {
    return reservationRepo.hasConfirmedReservationForUnit(user_id, unit_id);
  },
};

module.exports = reservationService;
