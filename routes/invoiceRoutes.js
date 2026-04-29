const express = require('express');
const { invoiceService } = require('../services');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAction } = require('../utils/audit');

const router = express.Router();

router.get('/mine', requireAuth, async (req, res) => {
  try {
    const rows = await invoiceService.getInvoicesByUser(req.session.user.user_id);
    res.json(rows);
  } catch (err) {
    console.error('Get invoices error:', err);
    res.status(500).json({ error: 'Server error fetching invoices.' });
  }
});

router.get('/', requireRole('admin'), async (req, res) => {
  try {
    const rows = await invoiceService.getAllInvoices();
    res.json(rows);
  } catch (err) {
    console.error('Get all invoices error:', err);
    res.status(500).json({ error: 'Server error fetching invoices.' });
  }
});

router.post('/:id/pay', requireRole('admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid invoice ID.' });

    const ok = await invoiceService.markInvoicePaid(id);
    if (!ok) return res.status(404).json({ error: 'Invoice not found.' });
    const actor = req.session.user;
    logAction(actor.user_id, `${actor.first_name} ${actor.last_name}`,
      'invoice.paid', 'invoice', id);
    res.json({ message: 'Invoice marked as paid.' });
  } catch (err) {
    console.error('Mark invoice paid error:', err);
    res.status(500).json({ error: 'Server error updating invoice.' });
  }
});

module.exports = router;