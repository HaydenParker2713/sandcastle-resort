jest.mock('../../repositories/ticketRepository');
jest.mock('../../repositories/reservationRepository');

const ticketRepo      = require('../../repositories/ticketRepository');
const reservationRepo = require('../../repositories/reservationRepository');
const ticketService   = require('../../services/ticket');
const { ForbiddenError } = require('../../errors');

const BASE = {
  unit_id:     10,
  created_by:  5,
  ticket_type: 'maintenance',
  title:       'Broken AC',
  description: 'AC unit not cooling',
};

describe('ticketService.createTicket', () => {
  it('skips reservation check for admin users', async () => {
    ticketRepo.insert.mockResolvedValue(99);
    const id = await ticketService.createTicket({ ...BASE, role_name: 'admin' });
    expect(reservationRepo.hasConfirmedReservationForUnit).not.toHaveBeenCalled();
    expect(id).toBe(99);
  });

  it('skips reservation check for staff users', async () => {
    ticketRepo.insert.mockResolvedValue(100);
    const id = await ticketService.createTicket({ ...BASE, role_name: 'staff' });
    expect(reservationRepo.hasConfirmedReservationForUnit).not.toHaveBeenCalled();
    expect(id).toBe(100);
  });

  it('throws ForbiddenError for guest with no confirmed reservation', async () => {
    reservationRepo.hasConfirmedReservationForUnit.mockResolvedValue(false);
    await expect(
      ticketService.createTicket({ ...BASE, role_name: 'guest' })
    ).rejects.toThrow(ForbiddenError);
    expect(ticketRepo.insert).not.toHaveBeenCalled();
  });

  it('creates ticket for guest with a confirmed reservation', async () => {
    reservationRepo.hasConfirmedReservationForUnit.mockResolvedValue(true);
    ticketRepo.insert.mockResolvedValue(77);
    const id = await ticketService.createTicket({ ...BASE, role_name: 'guest' });
    expect(reservationRepo.hasConfirmedReservationForUnit).toHaveBeenCalledWith(BASE.created_by, BASE.unit_id);
    expect(id).toBe(77);
  });
});

describe('ticketService.getTicketsByUser', () => {
  it('delegates to ticketRepo.findByUser', async () => {
    const tickets = [{ ticket_id: 1 }];
    ticketRepo.findByUser.mockResolvedValue(tickets);
    const result = await ticketService.getTicketsByUser(5);
    expect(ticketRepo.findByUser).toHaveBeenCalledWith(5);
    expect(result).toBe(tickets);
  });
});

describe('ticketService.getAllTickets', () => {
  it('delegates to ticketRepo.findAll', async () => {
    const tickets = [{ ticket_id: 1 }, { ticket_id: 2 }];
    ticketRepo.findAll.mockResolvedValue(tickets);
    const result = await ticketService.getAllTickets();
    expect(result).toBe(tickets);
  });
});

describe('ticketService.getTicketById', () => {
  it('returns null for unknown ticket', async () => {
    ticketRepo.findById.mockResolvedValue(null);
    const result = await ticketService.getTicketById(999);
    expect(result).toBeNull();
  });
});

describe('ticketService.updateTicketStatus', () => {
  it('passes through to ticketRepo.updateStatus', async () => {
    ticketRepo.updateStatus.mockResolvedValue(true);
    await ticketService.updateTicketStatus(1, 'closed', 3);
    expect(ticketRepo.updateStatus).toHaveBeenCalledWith(1, 'closed', 3);
  });
});
