-- Extends the invoices.status ENUM to include 'voided' so that when a
-- reservation is cancelled its invoice can be marked void rather than
-- left as 'unpaid', which would make it appear as an outstanding balance.
ALTER TABLE invoices
  MODIFY COLUMN status ENUM('unpaid', 'paid', 'voided') NOT NULL DEFAULT 'unpaid';
