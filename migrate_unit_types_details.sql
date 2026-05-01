-- Adds description, amenities, and photo_url to unit_types so admins can
-- enrich each room type with display info shown to guests.
ALTER TABLE unit_types
  ADD COLUMN description VARCHAR(2000) NULL AFTER nightly_rate,
  ADD COLUMN amenities   VARCHAR(2000) NULL AFTER description,
  ADD COLUMN photo_url   VARCHAR(500)  NULL AFTER amenities;
