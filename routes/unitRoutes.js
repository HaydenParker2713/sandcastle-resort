const express = require("express");
const path    = require("path");
const fs      = require("fs");
const multer  = require("multer");
const { unitService } = require("../services");
const { requireRole } = require("../middleware/auth");
const { logAction } = require("../utils/audit");

const router = express.Router();

const uploadDir = path.join(__dirname, "..", "public", "uploads", "units");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename:    (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `unit-${Date.now()}${ext}`);
  }
});
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const ALLOWED_EXT  = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_MIME.has(file.mimetype) || !ALLOWED_EXT.has(ext)) {
      return cb(new Error("Only JPEG, PNG, WebP, or GIF images are allowed (max 5 MB)."));
    }
    cb(null, true);
  }
});

router.get("/", async (req, res) => {
  try {
    const rows = await unitService.getAllUnits();
    res.json(rows);
  } catch (error) {
    console.error("Get units error:", error);
    res.status(500).json({ error: "Server error fetching units." });
  }
});

router.post("/", requireRole("admin"), async (req, res) => {
  try {
    const { unit_type_id, unit_code, status } = req.body;

    if (!unit_type_id || !unit_code) {
      return res.status(400).json({ error: "unit_type_id and unit_code are required." });
    }

    try {
      const insertId = await unitService.createUnit(unit_type_id, unit_code, status || "available");
      const actor    = req.session.user;
      const uType    = await unitService.getUnitTypeById(Number(unit_type_id));
      logAction(actor.user_id, `${actor.first_name} ${actor.last_name}`,
        'unit.create', 'unit', insertId, {
          unit_code,
          type_name: uType?.type_name || `type #${unit_type_id}`,
          status: status || 'available'
        });
      res.status(201).json({ message: "Unit created successfully.", unit_id: insertId });
    } catch (error) {
      if (error && error.code === "ER_DUP_ENTRY") {
        return res.status(409).json({ error: "Unit code already exists." });
      }
      throw error;
    }
  } catch (error) {
    console.error("Create unit error:", error);
    res.status(500).json({ error: "Server error creating unit." });
  }
});

router.get("/:id/availability", async (req, res) => {
  try {
    const unit_id = parseInt(req.params.id, 10);
    if (isNaN(unit_id)) return res.status(400).json({ error: "Invalid unit ID." });

    const rows = await unitService.getUnitAvailability(unit_id);
    res.json(rows);
  } catch (error) {
    console.error("Get availability error:", error);
    res.status(500).json({ error: "Server error fetching availability." });
  }
});

router.patch("/:id/status", requireRole("admin"), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid unit ID." });

    const { status } = req.body;
    const validStatuses = ["available", "maintenance", "inactive"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status." });
    }
    const before = await unitService.getUnitById(id);
    const ok = await unitService.updateUnitStatus(id, status);
    if (!ok) return res.status(404).json({ error: "Unit not found." });
    const actor = req.session.user;
    logAction(actor.user_id, `${actor.first_name} ${actor.last_name}`,
      'unit.status_change', 'unit', id, {
        unit_code:  before?.unit_code,
        type_name:  before?.type_name,
        from:       before?.status,
        to:         status
      });
    res.json({ message: "Unit status updated." });
  } catch (error) {
    console.error("Update unit status error:", error);
    res.status(500).json({ error: "Server error updating unit status." });
  }
});

// PATCH /api/units/:id/details — admin edits code, type, status, description, rate (JSON)
router.patch("/:id/details", ...requireRole("admin"), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid unit ID." });

    const updates = {};

    if (req.body.unit_code !== undefined) {
      const code = String(req.body.unit_code).trim().toUpperCase();
      if (!code) return res.status(400).json({ error: "Unit code cannot be empty." });
      updates.unit_code = code;
    }
    if (req.body.unit_type_id !== undefined) {
      const tid = parseInt(req.body.unit_type_id, 10);
      if (isNaN(tid)) return res.status(400).json({ error: "Invalid room type." });
      updates.unit_type_id = tid;
    }
    if (req.body.status !== undefined) {
      const validStatuses = ["available", "maintenance", "inactive"];
      if (!validStatuses.includes(req.body.status)) {
        return res.status(400).json({ error: "Invalid status." });
      }
      updates.status = req.body.status;
    }
    if (req.body.description !== undefined) {
      updates.description = String(req.body.description).trim() || null;
    }
    if (req.body.nightly_rate !== undefined) {
      const rate = parseFloat(req.body.nightly_rate);
      updates.nightly_rate = (req.body.nightly_rate === "" || req.body.nightly_rate === null || isNaN(rate)) ? null : rate;
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({ error: "Nothing to update." });
    }

    const before = await unitService.getUnitById(id);
    const ok = await unitService.updateUnitDetails(id, updates);
    if (!ok) return res.status(404).json({ error: "Unit not found." });
    const actor = req.session.user;
    logAction(actor.user_id, `${actor.first_name} ${actor.last_name}`,
      'unit.edit', 'unit', id, { unit_code: before?.unit_code, ...updates });
    res.json({ message: "Unit updated." });
  } catch (err) {
    if (err.code === "DUPLICATE_CODE") return res.status(409).json({ error: err.message });
    console.error("Update unit details error:", err);
    res.status(500).json({ error: "Server error updating unit." });
  }
});

// DELETE /api/units/:id — admin removes a unit (blocked if active reservations exist)
router.delete("/:id", ...requireRole("admin"), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid unit ID." });
    const before = await unitService.getUnitById(id);
    const ok = await unitService.deleteUnit(id);
    if (!ok) return res.status(404).json({ error: "Unit not found." });
    const actor = req.session.user;
    logAction(actor.user_id, `${actor.first_name} ${actor.last_name}`,
      'unit.delete', 'unit', id, {
        unit_code: before?.unit_code,
        type_name: before?.type_name
      });
    res.json({ message: "Unit deleted." });
  } catch (err) {
    if (err.code === "HAS_RESERVATIONS") return res.status(409).json({ error: err.message });
    console.error("Delete unit error:", err);
    res.status(500).json({ error: "Server error deleting unit." });
  }
});

// PATCH /api/units/:id/photo — admin uploads a unit photo (multipart)
// Multer is called as a promise inside try/catch so any file errors return JSON, not HTML.
router.patch("/:id/photo", ...requireRole("admin"), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid unit ID." });

    await new Promise((resolve, reject) =>
      upload.single("photo")(req, res, (err) => (err ? reject(err) : resolve()))
    );

    if (!req.file) return res.status(400).json({ error: "No photo provided." });

    const photo_url = `/uploads/units/${req.file.filename}`;
    const ok = await unitService.updateUnitDetails(id, { photo_url });
    if (!ok) return res.status(404).json({ error: "Unit not found." });
    res.json({ message: "Photo updated.", photo_url });
  } catch (err) {
    console.error("Update unit photo error:", err);
    res.status(500).json({ error: err.message || "Server error updating photo." });
  }
});

module.exports = router;