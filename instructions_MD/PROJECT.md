# Rack Builder — Project Overview

## What it is

A React + Vite web app for designing network rack elevation diagrams. Users build one or more racks (switches, patch panels, UPS, blanks, etc.), edit them in a table, preview the rendered elevation as inline SVG, and export diagrams as PNG (single or all racks as a ZIP).

## Current state (as of 6a6c5eb)

- Rack data model + validation/normalization in [rackUtils.js](../src/utils/rackUtils.js).
- Sample rack data in [sampleRacks.js](../src/data/sampleRacks.js).
- Editable rack table ([RackEditorTable.jsx](../src/components/RackEditorTable.jsx)) with resizable columns.
- Elevation rendering ([RackElevation.jsx](../src/components/RackElevation.jsx), [RackFrame.jsx](../src/components/RackFrame.jsx), [DeviceFaces.jsx](../src/components/DeviceFaces.jsx)) using pure inline SVG device faces (no image/foreignObject faces — replaced for reliability).
- Device type support includes Cisco switches, Extreme switches, UPS, patch panels (24-port voice type), and blank slots ([EmptySlot.jsx](../src/components/EmptySlot.jsx)).
- Import/export: JSON import ([JsonImportCard.jsx](../src/components/JsonImportCard.jsx)), file import ([FileImportCard.jsx](../src/components/FileImportCard.jsx)), File menu ([FileMenu.jsx](../src/components/FileMenu.jsx)), PNG export for current rack or all racks as ZIP with `_diagram`/`_simple` suffixes ([exportAllPng.js](../src/utils/exportAllPng.js), [exportUtils.js](../src/utils/exportUtils.js), [ExportPanel.jsx](../src/components/ExportPanel.jsx)).
- Resizable left/right panel layout with `localStorage`-persisted rack list, active rack index, and panel width ([App.jsx](../src/App.jsx)).
- Validation panel surfaces rack data warnings/errors ([ValidationPanel.jsx](../src/components/ValidationPanel.jsx)).
- Auto-fill label from device type; fuzzy type matching on import; blank rows default `EndRU = 1RU`; `MaxRU` fills forward.

## Repo / environment

- Origin: `https://github.com/TechhySupport/rack-builder`.
- Local dev: `npm install`, then `npm run dev` (Vite, default port 5173).
- Build: `npm run build`; preview build: `npm run preview`; lint: `npm run lint`.
