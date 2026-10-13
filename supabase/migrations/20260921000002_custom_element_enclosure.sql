-- ============================================================
-- Optional custom enclosure for a device element: wall thickness,
-- corner radius, and whether it has a lid. Stored as jsonb (null
-- when the element has no custom enclosure — e.g. a bare board)
-- so more enclosure attributes can be added later without another
-- migration. Cutouts for placed components already live in
-- connection_points / physical_features from the prior migration;
-- the enclosure shell is just the wall the design tool renders
-- those cutouts into.
-- ============================================================

alter table public.custom_device_elements
  add column enclosure jsonb;
