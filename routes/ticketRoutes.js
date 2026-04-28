// ── Ticket routes  /api/tickets ───────────────────────────────────────────────
// Guests submit support tickets for maintenance or housekeeping issues.
// Staff and admins can view all tickets and update their status.

const express   = require('express');
const rateLimit = require('express-rate-limit');
const { ticketService } = require('../services');
const { requireAuth, requireRole } = require('../middleware/auth');

// Limit ticket creation to 30 per hour per IP to prevent spam
const createLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many ticket submissions. Please try again later.' }
});

const router = express.Router();

// POST /api/tickets — create a new ticket
// Any logged-in user can submit; they must provide unit_id, ticket_type, and title.
router.post('/', requireAuth, createLimiter, async (req, res) => {
  try {
    const { unit_id, ticket_type, title, description } = req.body;

    // Validate required fields
    if (!unit_id || !ticket_type || !title) {
      return res.status(400).json({ error: 'unit_id, ticket_type, and title are required.' });
    }
    const validTypes = ['maintenance', 'housekeeping'];
    if (!validTypes.includes(ticket_type)) {
      return res.status(400).json({ error: 'ticket_type must be maintenance or housekeeping.' });
    }
    if (title.length > 150) {
      return res.status(400).json({ error: 'Title must be 150 characters or fewer.' });
    }

    const ticket_id = await ticketService.createTicket({
      unit_id: Number(unit_id),
      created_by: req.session.user.user_id, // taken from server-side session, not the request body
      ticket_type,
      title,
      description
    });
    res.status(201).json({ message: 'Ticket submitted.', ticket_id });
  } catch (err) {
    console.error('Create ticket error:', err);
    res.status(500).json({ error: 'Server error creating ticket.' });
  }
});

// GET /api/tickets — fetch tickets
// Staff/admin get ALL tickets; regular guests only get their own.
// The frontend uses this same endpoint for both views.
router.get('/', requireAuth, async (req, res) => {
  try {
    const isAdminOrStaff = ['admin', 'staff'].includes(req.session.user.role_name);
    const rows = isAdminOrStaff
      ? await ticketService.getAllTickets()
      : await ticketService.getTicketsByUser(req.session.user.user_id);
    res.json(rows);
  } catch (err) {
    console.error('Get tickets error:', err);
    res.status(500).json({ error: 'Server error fetching tickets.' });
  }
});

// PATCH /api/tickets/:id — update ticket status (open / in_progress / closed)
// Only staff and admin can change ticket status.
router.patch('/:id', requireRole('admin', 'staff'), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ticket ID.' });

    const { status } = req.body;
    const validStatuses = ['open', 'in_progress', 'closed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status.' });
    }
    const ok = await ticketService.updateTicketStatus(id, status, req.session.user.user_id);
    if (!ok) return res.status(404).json({ error: 'Ticket not found.' });
    res.json({ message: 'Ticket updated.' });
  } catch (err) {
    console.error('Update ticket error:', err);
    res.status(500).json({ error: 'Server error updating ticket.' });
  }
});

module.exports = router;
