// ── constants.js ─────────────────────────────────────────────────────────────
// Single source of truth for every enum/status string used across the app.
// Import this instead of hard-coding strings so typos become immediate errors.

const ROLES = {
  GUEST: 'guest',
  STAFF: 'staff',
  ADMIN: 'admin',
};

const RES_STATUS = {
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
};

const INVOICE_STATUS = {
  UNPAID:  'unpaid',
  PAID:    'paid',
  VOIDED:  'voided',
};

const TICKET_STATUS = {
  OPEN:        'open',
  IN_PROGRESS: 'in_progress',
  CLOSED:      'closed',
};

const UNIT_STATUS = {
  AVAILABLE:   'available',
  MAINTENANCE: 'maintenance',
  INACTIVE:    'inactive',
};

const TICKET_TYPES = {
  MAINTENANCE:  'maintenance',
  HOUSEKEEPING: 'housekeeping',
};

module.exports = { ROLES, RES_STATUS, INVOICE_STATUS, TICKET_STATUS, UNIT_STATUS, TICKET_TYPES };
