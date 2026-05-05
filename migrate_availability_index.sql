-- Add composite index to speed up unit availability overlap check
-- Query: WHERE unit_id = ? AND status = 'confirmed' AND check_in < ? AND check_out > ?
ALTER TABLE reservations
  ADD INDEX idx_res_availability (unit_id, status, check_in, check_out);
