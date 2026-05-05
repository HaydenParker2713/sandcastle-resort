-- Adds closed_by and closed_at to tickets so we can track who closed each ticket and when.
ALTER TABLE tickets
  ADD COLUMN closed_by BIGINT UNSIGNED NULL AFTER status,
  ADD COLUMN closed_at DATETIME        NULL AFTER closed_by,
  ADD CONSTRAINT fk_ticket_closed_by
    FOREIGN KEY (closed_by) REFERENCES users(user_id)
    ON UPDATE CASCADE ON DELETE SET NULL;
