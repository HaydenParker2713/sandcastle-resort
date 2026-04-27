const express = require("express");
const { pool } = require("../config/db");
const { unitService } = require("../services");
const { requireRole } = require("../middleware/auth");

const router = express.Router();

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

    const [rows] = await pool.execute(
      `SELECT check_in, check_out FROM reservations WHERE unit_id = ? AND status = 'confirmed'`,
      [unit_id]
    );
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
    const ok = await unitService.updateUnitStatus(id, status);
    if (!ok) return res.status(404).json({ error: "Unit not found." });
    res.json({ message: "Unit status updated." });
  } catch (error) {
    console.error("Update unit status error:", error);
    res.status(500).json({ error: "Server error updating unit status." });
  }
});

module.exports = router;