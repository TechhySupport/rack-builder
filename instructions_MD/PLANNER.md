# Rack Builder — Planner

Tracks upcoming/in-progress work. Update as items are picked up or finished; move finished items into the day's [instructions_MD](.) handoff file.

## In progress

- [ ] Connect racks to authenticated Supabase users/organizations, replacing local-only browser storage.

## Backlog

- [ ] Configure the Supabase publishable key in local `.env` and confirm Racked View Auth email delivery and redirect settings.
- [ ] Dark/light adaptive theming for `styles.css` (currently light-mode only, hard-coded palette).
- [ ] Additional device face types beyond Cisco/Extreme/UPS/patch panel, as new hardware is requested.
- [ ] Broader validation coverage in [ValidationPanel.jsx](../src/components/ValidationPanel.jsx) (e.g. duplicate RU ranges, overlapping slots).
- [ ] Review `npm audit` findings (10 vulnerabilities reported on install) and address where feasible.

## Done (most recent first)

- [x] Workspace member invitations for owners and admins: live member list, secure existing-account add-by-email fallback, and Supabase email invitations that create a recipient account and apply admin/editor/viewer access.
- [x] Card-based rack editor with first-free RU item placement, visible sizing controls, and duplicate/remove actions.
- [x] Guest rack builder: Start building opens a blank 42RU rack; all rack exports and printing require sign-in.
- [x] Racked View public landing page, Supabase Auth sign-up/sign-in screen, session-gated rack editor, and secure `.env` setup.
- [x] Voice type uses 24-port patch panel SVG.
- [x] Restore SVG image faces (`preserveAspectRatio=none`), Cisco rename, distinct Extreme face.
- [x] Replace all SVG image/foreignObject faces with pure inline SVG components.
- [x] UPS SVG fill via foreignObject, add `extreme_switch` type.
- [x] Auto-fill label from type, remove missing-label validation warning.
- [x] Blank rows default `EndRU = 1RU`, `MaxRU` fill-forward, fuzzy type match, updated template.
- [x] Export current/all racks as PNG (`_diagram`/`_simple` suffixes).
- [x] External callout labels right of rack; SVG assets fill slot.
- [x] Resizable panels, `localStorage` cache, resizable table columns, PNG export fix.
- [x] File menu with import/export, Export All PNG as ZIP, "+ new rack" button.

## How to use this file

1. Before starting new work, add a checkbox under **In progress**.
2. When finished, check it off, move it to **Done**, and log details in the appropriate `instructions_MD/DDMonthYYYY.md` handoff file.
3. Keep **Backlog** as the source of truth for not-yet-started ideas.
