const ticketRepo = require('../repositories/ticketRepository');
const reservationRepo = require('../repositories/reservationRepository');
const { ForbiddenError } = require('../errors');

const ticketService = {
  async createTicket({ unit_id, created_by, role_name, ticket_type, title, description }) {
    if (!['admin', 'staff'].includes(role_name)) {
      const allowed = await reservationRepo.hasConfirmedReservationForUnit(created_by, unit_id);
      if (!allowed) throw new ForbiddenError('You can only submit tickets for units you have reserved.');
    }
    return ticketRepo.insert({ unit_id, created_by, ticket_type, title, description });
  },

  async getTicketsByUser(user_id) {
    return ticketRepo.findByUser(user_id);
  },

  async getAllTickets() {
    return ticketRepo.findAll();
  },

  async getTicketById(ticket_id) {
    return ticketRepo.findById(ticket_id);
  },

  async updateTicketStatus(ticket_id, status, closed_by_user_id = null) {
    return ticketRepo.updateStatus(ticket_id, status, closed_by_user_id);
  },
};

module.exports = ticketService;
