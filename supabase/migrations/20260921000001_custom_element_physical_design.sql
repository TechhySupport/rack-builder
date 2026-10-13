-- ============================================================
-- Physical design metadata for custom device elements: real
-- manufacturing dimensions, a mounting method, and non-connector
-- physical features (mounting holes, fan grills, rack rails/ears,
-- indicators, controls) captured per physical face. These are
-- design/documentation metadata — only connection_points entries
-- tagged 'front' or 'rear' render as live patchable ports on the
-- rack elevation, since that renderer only ever shows those two
-- faces.
-- ============================================================

alter table public.custom_device_elements
  add column width_mm numeric(8,2) check (width_mm is null or width_mm > 0),
  add column height_mm numeric(8,2) check (height_mm is null or height_mm > 0),
  add column depth_mm numeric(8,2) check (depth_mm is null or depth_mm > 0),
  add column mounting_type text
    check (mounting_type is null or mounting_type in (
      'rack_rails', 'rack_ears', 'rack_shelf', 'rack_bracket', 'din_rail',
      'wall_bracket', 'vesa', 'desktop_enclosure', 'panel_mount',
      'screw_mount', 'clip_mount', 'custom'
    )),
  add column physical_features jsonb not null default '[]'::jsonb;
