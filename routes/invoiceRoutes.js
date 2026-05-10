const express = require('express');
const { invoiceService } = require('../services/index');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAction } = require('../utils/audit');
const { ROLES } = require('../constants');

const router = express.Router();

router.get('/mine', requireAuth, async (req, res, next) => {
  try {
    res.json(await invoiceService.getInvoicesByUser(req.session.user.user_id));
  } catch (err) { next(err); }
});

router.get('/', requireRole(ROLES.ADMIN), async (req, res, next) => {
  try {
    res.json(await invoiceService.getAllInvoices());
  } catch (err) { next(err); }
});

router.post('/:id/pay', requireRole(ROLES.ADMIN), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid invoice ID.' });

    const inv = await invoiceService.getInvoiceById(id);
    if (!inv) return res.status(404).json({ error: 'Invoice not found.' });

    const ok = await invoiceService.markInvoicePaid(id);
    if (!ok) return res.status(409).json({ error: 'Invoice has already been paid or voided.' });

    const actor = req.session.user;
    logAction(actor.user_id, `${actor.first_name} ${actor.last_name}`,
      'invoice.paid', 'invoice', id, {
        guest_name:  inv ? `${inv.first_name} ${inv.last_name}` : null,
        guest_email: inv?.email,
        unit_code:   inv?.unit_code,
        type_name:   inv?.type_name,
        check_in:    inv?.check_in,
        check_out:   inv?.check_out,
        amount:      inv?.total_amount,
      });
    res.json({ message: 'Invoice marked as paid.' });
  } catch (err) { next(err); }
});

module.exports = router;
