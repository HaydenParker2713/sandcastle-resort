-- ── Index optimisation migration ──────────────────────────────────────────────
-- Safe to run on a live DB. Each block drops the index if it already exists
-- then recreates it, so re-running this file is harmless.
--
-- Gaps identified (reservations + tickets already well-indexed in schema.sql):
--   invoices.status          – revenue queries filter/aggregate on this constantly
--   invoices(status,created_at) – monthly revenue chart filters both columns
--   units.status             – availability and admin listing filter on this

USE sandcastle_resort;

-- invoices.status
ALTER TABLE invoices DROP INDEX IF EXISTS idx_inv_status;
ALTER TABLE invoices ADD  INDEX           idx_inv_status (status);

-- invoices composite: status + created_at (covers monthly revenue chart query)
ALTER TABLE invoices DROP INDEX IF EXISTS idx_inv_status_date;
ALTER TABLE invoices ADD  INDEX           idx_inv_status_date (status, created_at);

-- units.status (unit_type_id is already indexed via the FK constraint)
ALTER TABLE units DROP INDEX IF EXISTS idx_units_status;
ALTER TABLE units ADD  INDEX           idx_units_status (status);
