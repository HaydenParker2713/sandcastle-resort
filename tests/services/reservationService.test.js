// Factory mocks must be defined before any require() so Jest hoisting picks them up.
jest.mock('../../repositories/reservationRepository');
jest.mock('../../repositories/invoiceRepository');
jest.mock('../../config/db', () => ({
  pool: { getConnection: jest.fn() },
}));

const reservationRepo    = require('../../repositories/reservationRepository');
const invoiceRepo        = require('../../repositories/invoiceRepository');
const { pool }           = require('../../config/db');
const reservationService = require('../../services/reservation');
const { NotFoundError, ConflictError, ForbiddenError } = require('../../errors');

let mockConn;
beforeEach(() => {
  mockConn = {
    beginTransaction: jest.fn().mockResolvedValue(),
    commit:           jest.fn().mockResolvedValue(),
    rollback:         jest.fn().mockResolvedValue(),
    release:          jest.fn(),
  };
  pool.getConnection.mockResolvedValue(mockConn);
});

const BOOKING = {
  user_id:   1,
  unit_id:   10,
  check_in:  '2026-06-01',
  check_out: '2026-06-05',
  adults:    2,
  children:  0,
};

describe('reservationService.createReservation', () => {
  it('throws NotFoundError when unit does not exist', async () => {
    reservationRepo.findUnitForBooking.mockResolvedValue(null);
    await expect(reservationService.createReservation(BOOKING)).rejects.toThrow(NotFoundError);
    expect(mockConn.rollback).toHaveBeenCalled();
    expect(mockConn.release).toHaveBeenCalled();
  });

  it('throws ConflictError when unit is not available', async () => {
    reservationRepo.findUnitForBooking.mockResolvedValue({ status: 'maintenance', nightly_rate: '150.00' });
    await expect(reservationService.createReservation(BOOKING)).rejects.toThrow(ConflictError);
    expect(mockConn.rollback).toHaveBeenCalled();
  });

  it('throws ConflictError on overlapping booking', async () => {
    reservationRepo.findUnitForBooking.mockResolvedValue({ status: 'available', nightly_rate: '150.00' });
    reservationRepo.findOverlap.mockResolvedValue([{ reservation_id: 5 }]);
    await expect(reservationService.createReservation(BOOKING)).rejects.toThrow(ConflictError);
    expect(mockConn.rollback).toHaveBeenCalled();
  });

  it('creates a reservation and invoice on success', async () => {
    reservationRepo.findUnitForBooking.mockResolvedValue({ status: 'available', nightly_rate: '150.00' });
    reservationRepo.findOverlap.mockResolvedValue([]);
    reservationRepo.insertReservation.mockResolvedValue(42);
    invoiceRepo.insert.mockResolvedValue();

    const id = await reservationService.createReservation(BOOKING);

    expect(reservationRepo.insertReservation).toHaveBeenCalled();
    expect(invoiceRepo.insert).toHaveBeenCalledWith(mockConn, {
      reservation_id: 42,
      total_amount:   '600.00', // 4 nights × $150
    });
    expect(mockConn.commit).toHaveBeenCalled();
    expect(mockConn.release).toHaveBeenCalled();
    expect(id).toBe(42);
  });
});

describe('reservationService.cancelReservation', () => {
  it('throws NotFoundError when reservation does not exist', async () => {
    reservationRepo.findForCancel.mockResolvedValue(null);
    await expect(reservationService.cancelReservation(99, 1)).rejects.toThrow(NotFoundError);
    expect(mockConn.rollback).toHaveBeenCalled();
    expect(mockConn.release).toHaveBeenCalled();
  });

  it('throws ConflictError when reservation is already cancelled', async () => {
    reservationRepo.findForCancel.mockResolvedValue({ reservation_id: 1, user_id: 1, status: 'cancelled' });
    await expect(reservationService.cancelReservation(1, 1)).rejects.toThrow(ConflictError);
    expect(mockConn.rollback).toHaveBeenCalled();
  });

  it('throws ForbiddenError when non-owner tries to cancel', async () => {
    reservationRepo.findForCancel.mockResolvedValue({ reservation_id: 1, user_id: 2, status: 'confirmed' });
    await expect(reservationService.cancelReservation(1, 99, false)).rejects.toThrow(ForbiddenError);
    expect(mockConn.rollback).toHaveBeenCalled();
  });

  it('cancels and voids the invoice successfully', async () => {
    reservationRepo.findForCancel.mockResolvedValue({ reservation_id: 1, user_id: 5, status: 'confirmed' });
    reservationRepo.cancelReservation.mockResolvedValue();
    invoiceRepo.voidUnpaid.mockResolvedValue();

    await reservationService.cancelReservation(1, 5, false);

    expect(reservationRepo.cancelReservation).toHaveBeenCalledWith(mockConn, 1);
    expect(invoiceRepo.voidUnpaid).toHaveBeenCalledWith(mockConn, 1);
    expect(mockConn.commit).toHaveBeenCalled();
    expect(mockConn.release).toHaveBeenCalled();
  });

  it('allows admin to cancel any reservation', async () => {
    reservationRepo.findForCancel.mockResolvedValue({ reservation_id: 1, user_id: 5, status: 'confirmed' });
    reservationRepo.cancelReservation.mockResolvedValue();
    invoiceRepo.voidUnpaid.mockResolvedValue();

    await expect(reservationService.cancelReservation(1, 999, true)).resolves.toBeUndefined();
    expect(mockConn.commit).toHaveBeenCalled();
  });
});
