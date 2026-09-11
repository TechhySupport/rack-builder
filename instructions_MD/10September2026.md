# 10 September 2026 - Daily Handoff

## Builder Toolbar Cleanup

- Simplified the rack builder title bar by removing the non-functional undo, redo, zoom, fit, and percentage controls.
- Reduced the title bar height and typography; it now presents the rack breadcrumb/name, compact Front/Rear control, and File menu without crowding the canvas.
- Restored the toolbar controls after feedback and wired them to editor behavior: undo/redo restores rack-layout history, zoom-in changes the canvas scale, percentage and fit reset to 100%, and Front/Rear switches the active presentation state.
- Added a Zoom Out control and made the percentage control a functional zoom menu with selectable 50%, 75%, 100%, 125%, and 150% canvas scales.
- Added a double-click Device Properties dialog to rack faceplates. It stores device name, brand/manufacturer, model, IP address, MAC address, serial number, asset tag, and notes in the local rack record. The linked Supabase schema could not be dumped because Docker Desktop is unavailable; the existing verified `devices` save fields remain unchanged until remote metadata columns can be confirmed.

## Files Changed

- `src/App.jsx`
- `src/styles.css`

## Vendor-Agnostic Device Connections

- Replaced label/type-derived port counts with a local per-device `connectionPoints` inventory. Each point stores a stable ID, editable name, category, medium, and direction.
- Extended the device properties dialog with rack height and a connection-point editor for network, WAN, fibre, power input/output, and custom endpoints.
- Updated technical faceplates, selection, cable anchors, and compatibility rules to use the configured endpoint records. Copper, fibre, and power cabling now validate media and endpoint direction rather than device vendor, model, or category.
- Added generic library choices for router, NAS, storage, appliance, and other hardware. Supabase writes remain confined to confirmed device columns; the richer local configuration is retained in browser rack storage.

## Canvas Drag And Drop

- Added drag-and-drop for Text, Shapes, Wiring, and Tools library entries. Dropped items are placed at the pointer position on the rack canvas; their existing click-to-add behavior is preserved.
- Added image-file drops directly onto the rack canvas, in addition to the Images panel file picker.

## Rack Properties

- Double-clicking the technical rack header now opens a rack properties dialog, separate from individual device properties.
- Rack properties include name, identifier, total rack units, site, location, room/area, description, and notes. Values persist with the local rack record; only confirmed Supabase rack columns continue to be saved remotely.