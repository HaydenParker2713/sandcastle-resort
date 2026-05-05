-- Run this ONLY if you have an existing database and don't want to re-run schema.sql
-- Safe to run multiple times (IF NOT EXISTS guards the columns)
USE sandcastle_resort;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS reset_token        VARCHAR(64)  DEFAULT NULL AFTER password_hash,
  ADD COLUMN IF NOT EXISTS reset_token_expiry DATETIME     DEFAULT NULL AFTER reset_token;
