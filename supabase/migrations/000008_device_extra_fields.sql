ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS ip_address    text,
  ADD COLUMN IF NOT EXISTS mac_address   text,
  ADD COLUMN IF NOT EXISTS serial_number text,
  ADD COLUMN IF NOT EXISTS asset_tag     text;
