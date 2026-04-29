-- ── Audit log migration ───────────────────────────────────────────────────────
-- Safe to run on a live DB. CREATE TABLE IF NOT EXISTS is idempotent.

USE sandcastle_resort;

CREATE TABLE IF NOT EXISTS audit_log (
  log_id      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  actor_id    BIGINT UNSIGNED NULL,
  actor_name  VARCHAR(101)    NULL,
  action      VARCHAR(60)     NOT NULL,
  target_type VARCHAR(30)     NOT NULL,
  target_id   BIGINT UNSIGNED NOT NULL,
  detail      JSON            NULL,
  created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (log_id),
  INDEX idx_audit_actor      (actor_id),
  INDEX idx_audit_target     (target_type, target_id),
  INDEX idx_audit_created_at (created_at)
);
