DROP DATABASE IF EXISTS sandcastle_resort;
CREATE DATABASE sandcastle_resort;
USE sandcastle_resort;

CREATE TABLE roles (
  role_id   TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
  role_name VARCHAR(20)      NOT NULL,
  PRIMARY KEY (role_id),
  UNIQUE KEY uq_role_name (role_name)
);

INSERT INTO roles (role_name) VALUES ('guest'), ('staff'), ('admin');

CREATE TABLE users (
  user_id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  role_id            TINYINT UNSIGNED NOT NULL DEFAULT 1,
  first_name         VARCHAR(50)  NOT NULL,
  last_name          VARCHAR(50)  NOT NULL,
  email              VARCHAR(255) NOT NULL,
  password_hash      VARCHAR(255) NOT NULL,
  reset_token        VARCHAR(64),
  reset_token_expiry DATETIME,
  created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_users_email (email),
  CONSTRAINT fk_users_role
    FOREIGN KEY (role_id) REFERENCES roles(role_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE unit_types (
  unit_type_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  type_name    VARCHAR(50)  NOT NULL,
  capacity     INT          NOT NULL,
  nightly_rate DECIMAL(10,2) NOT NULL,
  description  VARCHAR(2000) NULL,
  amenities    VARCHAR(2000) NULL,
  photo_url    VARCHAR(500)  NULL,
  PRIMARY KEY (unit_type_id),
  UNIQUE KEY uq_unit_type_name (type_name)
);

INSERT INTO unit_types (type_name, capacity, nightly_rate) VALUES
  ('Studio',                                      2, 149.00),
  ('One Bedroom Suite',                           4, 229.00),
  ('Two Bedroom Suite',                           6, 329.00),
  ('Oceanfront Suite with Balcony',               4, 349.00),
  ('Oceanfront Studio with Balcony',              2, 199.00),
  ('Poolside Suite with Balcony',                 4, 279.00),
  ('Poolside Studio with Balcony',                2, 169.00),
  ('Standard Suite - Main Building',              4, 219.00),
  ('Standard Studio - Main Building',             2, 139.00),
  ('Queen Suite with Balcony - Main Building',    4, 239.00),
  ('Standard Studio with Balcony - Main Building',2, 149.00),
  ('Small Suite with Balcony',                    3, 199.00),
  ('Standard Studio with Balcony - Pool Building',2, 159.00);

CREATE TABLE units (
  unit_id       BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  unit_type_id  INT UNSIGNED    NOT NULL,
  unit_code     VARCHAR(20)     NOT NULL,
  status        ENUM('available','maintenance','inactive') NOT NULL DEFAULT 'available',
  description   VARCHAR(2000)   NULL,
  photo_url     VARCHAR(500)    NULL,
  nightly_rate  DECIMAL(10,2)   NULL,   -- overrides unit_type rate when set
  PRIMARY KEY (unit_id),
  UNIQUE KEY uq_unit_code (unit_code),
  INDEX idx_units_status (status),
  CONSTRAINT fk_units_type
    FOREIGN KEY (unit_type_id) REFERENCES unit_types(unit_type_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

INSERT INTO units (unit_type_id, unit_code, status) VALUES
  -- Studio (type 1)
  (1, 'A101', 'available'),
  (1, 'A102', 'available'),
  (1, 'A103', 'available'),
  -- One Bedroom Suite (type 2)
  (2, 'B201', 'available'),
  (2, 'B202', 'maintenance'),
  (2, 'B203', 'available'),
  -- Two Bedroom Suite (type 3)
  (3, 'C301', 'available'),
  (3, 'C302', 'available'),
  -- Oceanfront Suite with Balcony (type 4)
  (4, 'D101', 'available'),
  (4, 'D102', 'available'),
  -- Oceanfront Studio with Balcony (type 5)
  (5, 'D201', 'available'),
  (5, 'D202', 'available'),
  -- Poolside Suite with Balcony (type 6)
  (6, 'E101', 'available'),
  (6, 'E102', 'available'),
  -- Poolside Studio with Balcony (type 7)
  (7, 'E201', 'available'),
  (7, 'E202', 'available'),
  -- Standard Suite - Main Building (type 8)
  (8, 'F101', 'available'),
  (8, 'F102', 'available'),
  -- Standard Studio - Main Building (type 9)
  (9, 'F201', 'available'),
  (9, 'F202', 'available'),
  -- Queen Suite with Balcony - Main Building (type 10)
  (10, 'F301', 'available'),
  (10, 'F302', 'available'),
  -- Standard Studio with Balcony - Main Building (type 11)
  (11, 'F401', 'available'),
  (11, 'F402', 'available'),
  -- Small Suite with Balcony (type 12)
  (12, 'G101', 'available'),
  (12, 'G102', 'available'),
  -- Standard Studio with Balcony - Pool Building (type 13)
  (13, 'G201', 'available'),
  (13, 'G202', 'available');

CREATE TABLE reservations (
  reservation_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id        BIGINT UNSIGNED NOT NULL,
  unit_id        BIGINT UNSIGNED NOT NULL,
  check_in       DATE NOT NULL,
  check_out      DATE NOT NULL,
  adults         INT  NOT NULL DEFAULT 1,
  children       INT  NOT NULL DEFAULT 0,
  status         ENUM('confirmed','cancelled') NOT NULL DEFAULT 'confirmed',
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (reservation_id),
  INDEX idx_res_user_id      (user_id),
  INDEX idx_res_unit_id      (unit_id),
  INDEX idx_res_check_in     (check_in),
  INDEX idx_res_status       (status),
  INDEX idx_res_availability (unit_id, status, check_in, check_out),
  CONSTRAINT fk_res_user
    FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_res_unit
    FOREIGN KEY (unit_id) REFERENCES units(unit_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_dates CHECK (check_out > check_in)
);

CREATE TABLE invoices (
  invoice_id     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  reservation_id BIGINT UNSIGNED NOT NULL,
  total_amount   DECIMAL(10,2)  NOT NULL,
  status         ENUM('unpaid','paid','voided') NOT NULL DEFAULT 'unpaid',
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (invoice_id),
  UNIQUE KEY uq_invoice_reservation (reservation_id),
  INDEX idx_inv_status      (status),
  INDEX idx_inv_status_date (status, created_at),
  CONSTRAINT fk_invoice_reservation
    FOREIGN KEY (reservation_id) REFERENCES reservations(reservation_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE tickets (
  ticket_id   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  unit_id     BIGINT UNSIGNED NOT NULL,
  created_by  BIGINT UNSIGNED NOT NULL,
  ticket_type ENUM('maintenance','housekeeping') NOT NULL,
  title       VARCHAR(150)   NOT NULL,
  description TEXT,
  status      ENUM('open','in_progress','closed') NOT NULL DEFAULT 'open',
  closed_by   BIGINT UNSIGNED NULL,
  closed_at   DATETIME NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (ticket_id),
  INDEX idx_ticket_user_id (created_by),
  INDEX idx_ticket_unit_id (unit_id),
  INDEX idx_ticket_status  (status),
  CONSTRAINT fk_ticket_unit
    FOREIGN KEY (unit_id) REFERENCES units(unit_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_ticket_user
    FOREIGN KEY (created_by) REFERENCES users(user_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_ticket_closed_by
    FOREIGN KEY (closed_by) REFERENCES users(user_id)
    ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE TABLE reviews (
  review_id      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  reservation_id BIGINT UNSIGNED NOT NULL,
  user_id        BIGINT UNSIGNED NOT NULL,
  unit_id        BIGINT UNSIGNED NOT NULL,
  rating         TINYINT UNSIGNED NOT NULL,
  comment        TEXT,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (review_id),
  UNIQUE KEY uq_review_reservation (reservation_id),
  INDEX idx_review_unit_id (unit_id),
  INDEX idx_review_user_id (user_id),
  CONSTRAINT chk_rating CHECK (rating BETWEEN 1 AND 5),
  CONSTRAINT fk_review_reservation
    FOREIGN KEY (reservation_id) REFERENCES reservations(reservation_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_review_user
    FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_review_unit
    FOREIGN KEY (unit_id) REFERENCES units(unit_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE audit_log (
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

-- Demo admin account (password: Admin123!)
-- Run seed.sql separately to add this after a fresh schema reset.