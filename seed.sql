-- Demo seed data — run AFTER schema.sql
-- Usage: mysql -uroot -p sandcastle_resort < seed.sql
USE sandcastle_resort;

-- Demo admin account
-- Email: admin@sandcastle.com  |  Password: Admin123!
INSERT INTO users (role_id, first_name, last_name, email, password_hash)
VALUES (
  3,
  'Admin',
  'User',
  'admin@sandcastle.com',
  '$2b$10$Ih5lWmeISCpPycyeUvBza.nQnu9OY.qI7j1uhgb0YvqHtMwrYcQ6y'
);

-- Demo staff account (same demo password: Admin123!)
-- Change this password after first login in a real deployment
INSERT INTO users (role_id, first_name, last_name, email, password_hash)
VALUES (
  2,
  'Staff',
  'Member',
  'staff@sandcastle.com',
  '$2b$10$Ih5lWmeISCpPycyeUvBza.nQnu9OY.qI7j1uhgb0YvqHtMwrYcQ6y'
);