const express   = require('express');
const rateLimit = require('express-rate-limit');
const { ticketService } = require('../services/index');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAction } = require('../utils/audit');
const { ROLES, TICKET_STATUS, TICKET_TYPES } = require('../constants');

const createLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many ticket submissions. Please try again later.' },
});

const router = express.Router();

router.post('/', requireAuth, createLimiter, async (req, res) => {
  try {
    const { unit_id, ticket_type, title, description } = req.body;

    if (!unit_id || !ticket_type || !title) {
      return res.status(400).json({ error: 'unit_id, ticket_type, and title are required.' });
    }
    const validTypes = Object.values(TICKET_TYPES);
    if (!validTypes.includes(ticket_type)) {
      return res.status(400).json({ error: `ticket_type must be one of: ${validTypes.join(', ')}.` });
    }
    if (title.length > 150) {
      return res.status(400).json({ error: 'Title must be 150 characters or fewer.' });
    }

    const ticket_id = await ticketService.createTicket({
      unit_id:    Number(unit_id),
      created_by: req.session.user.user_id,
      ticket_type,
      title,
      description,
    });
    res.status(201).json({ message: 'Ticket submitted.', ticket_id });
  } catch (err) {
    console.error('Create ticket error:', err);
    res.status(500).json({ error: 'Server error creating ticket.' });
  }
});

router.get('/', requireAuth, async (req, res) => {
  try {
    const isAdminOrStaff = [ROLES.ADMIN, ROLES.STAFF].includes(req.session.user.role_name);
    const rows = isAdminOrStaff
      ? await ticketService.getAllTickets()
      : await ticketService.getTicketsByUser(req.session.user.user_id);
    res.json(rows);
  } catch (err) {
    console.error('Get tickets error:', err);
    res.status(500).json({ error: 'Server error fetching tickets.' });
  }
});

router.patch('/:id', requireRole(ROLES.ADMIN, ROLES.STAFF), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ticket ID.' });

    const { status } = req.body;
    const validStatuses = Object.values(TICKET_STATUS);
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}.` });
    }

    const ticket = await ticketService.getTicketById(id);
    const ok     = await ticketService.updateTicketStatus(id, status, req.session.user.user_id);
    if (!ok) return res.status(404).json({ error: 'Ticket not found.' });

    const actor = req.session.user;
    logAction(actor.user_id, `${actor.first_name} ${actor.last_name}`,
      'ticket.status_change', 'ticket', id, {
        title:       ticket?.title,
        ticket_type: ticket?.ticket_type,
        unit_code:   ticket?.unit_code,
        reporter:    ticket ? `${ticket.first_name} ${ticket.last_name}` : null,
        from:        ticket?.status,
        to:          status,
      });
    res.json({ message: 'Ticket updated.' });
  } catch (err) {
    console.error('Update ticket error:', err);
    res.status(500).json({ error: 'Server error updating ticket.' });
  }
});

module.exports = router;
