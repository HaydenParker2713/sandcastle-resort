const express = require('express');
const { unitService } = require('../services/index');
const { requireRole } = require('../middleware/auth');
const { createUploader } = require('../middleware/upload');
const { logAction } = require('../utils/audit');
const { ROLES } = require('../constants');

const router = express.Router();
const upload = createUploader('units', 'unit-type-');

router.get('/', async (req, res, next) => {
  try {
    res.json(await unitService.getAllUnitTypes());
  } catch (err) { next(err); }
});

router.patch('/:id', ...requireRole(ROLES.ADMIN), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid unit type ID.' });

    await new Promise((resolve, reject) =>
      upload.single('photo')(req, res, err => (err ? reject(err) : resolve()))
    );

    const updates = {};
    if (req.body.description  !== undefined) updates.description  = req.body.description.trim()  || null;
    if (req.body.amenities    !== undefined) updates.amenities    = req.body.amenities.trim()    || null;
    if (req.body.nightly_rate !== undefined && req.body.nightly_rate !== '') {
      const rate = parseFloat(req.body.nightly_rate);
      if (isNaN(rate) || rate < 0) return res.status(400).json({ error: 'Invalid nightly rate.' });
      updates.nightly_rate = rate;
    }
    if (req.file) updates.photo_url = `/uploads/units/${req.file.filename}`;

    if (!Object.keys(updates).length) {
      return res.status(400).json({ error: 'Nothing to update.' });
    }

    const ok = await unitService.updateUnitTypeDetails(id, updates);
    if (!ok) return res.status(404).json({ error: 'Unit type not found.' });

    const actor     = req.session.user;
    const typeInfo  = await unitService.getUnitTypeById(id);
    const logDetail = { type_name: typeInfo?.type_name, ...updates };
    delete logDetail.photo_url;
    if (req.file) logDetail.photo_updated = true;
    logAction(actor.user_id, `${actor.first_name} ${actor.last_name}`,
      'room_type.edit', 'room_type', id, logDetail);

    res.json({ message: 'Room type updated.', ...(req.file ? { photo_url: updates.photo_url } : {}) });
  } catch (err) { next(err); }
});

module.exports = router;
