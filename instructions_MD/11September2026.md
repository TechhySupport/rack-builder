# 11 September 2026 - Daily Handoff

## Rack Validation and Supabase Save Guidance

- Empty racks are now treated as valid work-in-progress records, so the builder no longer reports `Rack "test": No items defined.` as an error.
- The builder saves to Supabase only for authenticated sessions. Guest builder sessions have no server credential and cannot write to Supabase; the authenticated header exposes `Save to workspace`.
- Added a guest `Sign in to save` action so the required authentication step is visible instead of silently unavailable.
- Authenticated saves require an active organisation membership and at least one site. Errors from those checks are shown in the builder status bar before rack/device data is written.

## Sleek Builder Layout

- Consolidated the rack builder into a single compact editor header: rack name on the left, working controls centered, and save/account actions on the right.
- Removed the redundant RackedView branding, global navigation, global search, and separate rack title strip from the editing workspace so the device library and canvas begin directly beneath the header.

## Builder Overlap Fixes

- Fixed the compact header at medium widths so account/save actions occupy a dedicated right-hand grid column rather than overlapping the centered tool controls.
- Reduced the toolbar at narrower widths while retaining the zoom level, Front/Rear view selector, and save action.
- Prevented the canvas hint from wrapping across the rack by constraining it to a single truncated line, and restored responsive library/canvas grid tracks below 1120px.
- Moved editor controls into the header's normal layout flow instead of positioning a second toolbar layer over the header. This removes control-on-control overlap at wide sizes and keeps save actions on the same row at medium widths.
- Reordered the compact header so File, Front/Rear, zoom, and editing controls sit on the left while the active rack name is aligned to the right, immediately before save/account actions.
- Set the requested primary top-left control order to `File`, `Front / Rear`, then the zoom percentage. Undo/redo and the zoom/fit icons follow as secondary controls.
- Moved the Front/Rear switch and all zoom controls into a Canva-style bottom-right canvas utility bar. The header now retains File plus undo/redo only; the zoom menu opens upward from the canvas bar.
- Made the bottom-right view and zoom utility bar a fixed, Canva-style viewport control layer. It remains immediately visible and locked to the lower-right while the rack scrolls behind it.
- Removed the secondary `Rack builder` label from the editor header, leaving only the active rack name.
- Added browser-history routing for the rack builder at `/b/builder`. Opening the builder pushes that URL, direct production refreshes restore the builder through Cloudflare's SPA fallback, and browser Back returns to the main `/` view.
- For local route-refresh testing, use `npx wrangler dev --ip 127.0.0.1 --port 5173`. Python's basic `http.server` does not provide SPA fallback and returns a server 404 for `/b/builder`; Wrangler correctly returns the app shell.
- Fixed the `Sign in to save` flow so a successful password sign-in explicitly returns to the requested builder view at `/b/builder`, with the Supabase auth-state listener also synchronizing authenticated builder sessions to that route.
- Added a 15-second authentication timeout and guaranteed loading-state cleanup so Supabase failures cannot leave the form on `Please wait`. Gateway, network, and timeout failures now show a clear temporary-unavailability message. Independent probes confirmed the configured project's Auth health/token routes currently time out upstream while its REST gateway remains reachable.
- Confirmed the configured anon key matches the project's current key, and the newer publishable key fails identically. Supabase CLI reports the project `ACTIVE_HEALTHY`, but linked read-only database inspection fails with status `544`: `Failed to create login role: Connection terminated due to connection timeout`. This is a Supabase database data-plane failure requiring a project restart or Supabase support intervention.
- Supabase's status page lists an active `Unresponsive Projects` incident affecting Nano projects and explicitly asks still-affected users to restart their projects. TCP connectivity to the Mumbai pooler succeeds, but this project's database process remains unresponsive behind it, matching the incident symptoms.
- Added dedicated refresh-safe authentication routes: `/a/login`, `/a/signup`, and `/a/reset-password`. Builder sign-in uses `/a/login?returnTo=%2Fb%2Fbuilder`; auth mode switches update browser history, Back returns to the builder, and successful login replaces the auth URL with the validated internal return route.
- Added credential-safe auth diagnostics. Browser console events report auth mode, duration, status, and timeout/error state. On localhost only, the same metadata is mirrored to self-describing `/__auth-debug/...` requests so Wrangler prints the timeline in its terminal; emails, passwords, tokens, headers, and response bodies are never logged.
- Replaced the hard-coded `RV` header avatar with the signed-in user's profile image when available and account-derived initials otherwise.
- Made `Save to workspace` automatically provision an owner workspace and `Default Site` for newly signed-in accounts. Corrected the rack write from invalid `doc_status: documented` to the live enum value `current`, and aligned the dashboard count. Verified the authenticated save completes with `Rack devices saved to your workspace.`
- Added an authenticated avatar dropdown with account identity plus working `Dashboard`, `Settings`, and `Sign out` actions. The menu closes on outside click or Escape and exposes menu semantics for keyboard and assistive technology users.
- Added refresh-safe `/dashboard` and `/settings` routes with browser Back support. Sign out now clears the Supabase session and returns the browser to `/`.
- Added an account settings screen for updating the display name in both Supabase Auth metadata and `profiles.full_name`, with read-only email, dashboard/builder navigation, and inline success/error states.
- Validated the production build, direct `/settings` refresh, avatar menu contents, Dashboard and Settings navigation, and Back navigation to `/b/builder`. VS Code diagnostics report no errors in the touched files.
- Reworked device connection-point editing into compact groups with a quantity field. A row such as `Network / Copper / 28` now expands on save to `Network 1` through `Network 28`, preserving individually addressable endpoint IDs for exact cabling.
- Added vendor-neutral connection defaults by device type, including network/fibre/power groups for switches, routers, firewalls, servers, storage, NVRs, UPS units, PDUs, appliances, and generic devices. Passive rack accessories remain without forced endpoints.
- Existing saved endpoint arrays are grouped for editing and expanded back on save while retaining existing IDs where possible, preserving cable references when quantities are unchanged or increased.
- Raised property modals above the fixed canvas controls so the lower-right toolbar no longer overlaps or intercepts `Save device`. Validated the 28-port workflow end to end, production build, desktop layout, and a 390px mobile viewport without horizontal overflow.
- Added configurable port naming to each connection group. Short prefixes concatenate directly (`Gi` -> `Gi1...Gi28`, `Mi` -> `Mi1...Mi28`), structured prefixes work (`Gi1/0/` -> `Gi1/0/1`), `{n}` can be placed explicitly, and descriptive labels retain spaced numbering (`Network` -> `Network 1`). The saved pattern groups correctly when reopening the device, and existing endpoint IDs remain stable.
- Added an explicit `Panel identifier` field for patch panels. New panels default to identifier `A` with 24 ports; entering identifier `G` and quantity `48` generates individually addressable ports `G1` through `G48` and restores as `G / 48` when reopened. Widened the desktop properties modal and stacked connection controls at narrower widths so Direction and quantity labels do not clip; verified at 390px without horizontal overflow.
- Replaced free-text interface prefixes on Switch devices with a fixed dropdown containing Gi/GigabitEthernet, Fa/FastEthernet, Te/TenGigabitEthernet, Fo/FortyGigabitEthernet, Hu/HundredGigabitEthernet, and Eth/Ethernet, including an example label for each option. Each choice stores its numbering pattern, so Gi with 48 ports generates `Gi1/0/1` through `Gi1/0/48`; all six patterns were verified through port 48 and persist when reopened.
- Expanded the desktop device modal and prefix column so full Switch dropdown labels remain visible, with connection rows switching to a responsive two-column layout below 940px. Patch-panel identifiers and other non-Switch prefix fields remain free text.
- Corrected the oversized Switch configuration scale after visual review: reduced the device modal from 920px to 780px and replaced stretched fractional connection columns with deliberate compact widths. The prefix remains wide enough for its interface label while category, medium, direction, quantity, and delete controls stay dense; verified with no clipping or horizontal overflow.

## Switch Manufacturer Catalog

- Added and deployed Supabase migration `20260911000000_switch_brand_catalog.sql`. It creates the canonical `switch_brands` catalog, the moderated `switch_brand_submissions` queue, trigram/name indexes, active-brand search RPC, admin review RPC, RLS policies, seed manufacturers, and `devices.switch_brand_id` / `devices.custom_manufacturer` columns.
- Platform catalog administration uses Supabase Auth `app_metadata.role = "admin"` or `app_metadata.is_admin = true`; organisation membership roles do not grant catalog-review access.
- Added a reusable searchable Switch manufacturer combobox with 180ms debouncing, ranked partial matches, loading/error/empty states, keyboard selection, Escape/outside-click dismissal, clear action, and an explicit custom-manufacturer fallback. Other device types retain their existing free-text brand field.
- Added a portaled submission dialog for signed-in users. Exact catalog duplicates offer the existing official brand, new submissions enter the pending review queue, and successful submissions remain immediately usable as custom manufacturer text.
- Official selections persist both the compatible manufacturer name and `switch_brand_id`; custom selections persist the name in both `manufacturer` and `custom_manufacturer` with a null official ID. Local save/reopen and authenticated workspace save were verified for both paths.
- Browser validation confirmed `Cis` -> Cisco, `Jun` -> Juniper, `Ubi` -> Ubiquiti, ArrowDown/Enter selection, duplicate detection without closing the parent device form, custom fallback, successful authenticated submission, and save/reopen state. Validation fixtures were deleted afterward.
- RLS validation confirmed anonymous catalog search succeeds, anonymous direct catalog/submission inserts are rejected with `42501`, and anonymous review-queue reads expose zero rows. The production build and touched-file diagnostics pass.

## Switch Model Catalog

- Added and deployed migration `20260911000001_switch_model_catalog.sql`. It creates manufacturer-scoped `switch_models`, a moderated `switch_model_submissions` queue, ranked partial-search and admin-review RPCs, RLS policies, model indexes, common vendor model seeds, and `devices.switch_model_id` / `devices.custom_model` columns.
- Added a searchable Switch model selector that depends on the selected official manufacturer. Results include optional product-family context; changing the manufacturer clears an incompatible model selection. Custom model entry remains available for official or custom manufacturers.
- Added authenticated model submissions with model name, optional product family, and review notes. Exact duplicates offer the existing official model, while accepted submissions remain immediately usable as custom text pending review.
- Official models preserve the existing `devices.model` text while also storing `switch_model_id`; custom models store `model` and `custom_model` with a null official ID. Non-Switch device model fields remain free text for backward compatibility.
- Live validation confirmed Cisco `930` -> `Catalyst 9300`, Juniper `EX4100`, keyboard selection, manufacturer-change invalidation, duplicate reuse, custom save/reopen, successful authenticated submission, and workspace persistence of both manufacturer and model UUIDs.
- Model RLS validation confirmed public scoped search, blocked anonymous catalog/submission inserts, and a private review queue. Desktop and 390px mobile layouts have no horizontal overflow. All submission, workspace, and local browser fixtures were removed after testing.

## Exact SKU Connection Profiles

- Added and deployed migration `20260911000002_switch_connection_profiles.sql`. Switch models now distinguish broad product families from exact SKUs, with optional parent-family relationships and one active versioned connection profile per exact model.
- Added reusable connection templates with stable semantic keys, explicit numbering behavior, category, medium, direction, speed, PoE capability, connector type, source URL, verification metadata, and ordered profile groups. No inferred or guessed production model profiles were seeded.
- Public catalog searches now expose family/exact-SKU and verified-profile status. Verified profile details are readable through a dedicated RPC; only platform admins can create or modify catalog profiles and templates.
- Selecting an exact SKU with a verified profile immediately generates editable device connection groups. Singleton/vendor-specific labels such as `MGMT`, `CONSOLE`, and `PSU1` remain literal text fields, while recognized Ethernet interface patterns retain the fixed interface dropdown.
- Reapplying the same model/profile preserves endpoint IDs through stable template keys. A manufacturer or model change that would replace customized endpoints requires confirmation; cancelling keeps the committed selection and endpoint data unchanged.
- Profile-derived groups retain source template IDs plus speed, PoE, and connector metadata. These fields are editable in the device modal, and all manual group edits, additions, and removals mark the copied endpoint set as customized.
- Workspace saves persist profile/version provenance on `devices` and replace each device's copied endpoint snapshot in `device_connection_points`. Catalog profile corrections therefore affect future generation only and never mutate documented rack devices.
- Verified live behavior included exact-SKU search/status, a six-group/ten-point profile response, immediate profile application, and anonymous write rejection with PostgreSQL `42501`. Focused lint, the production build, and local/remote migration parity pass. The temporary validation model, profile, templates, and local Switch fixture were removed after testing; no persisted workspace device referenced the fixture.

## Reusable User-Added Switch Models

- Added and deployed migration `20260911000003_user_switch_models.sql`. Signed-in users can now save a manually entered switch model once and find it under `Saved by you` in future model searches for the same manufacturer.
- Saved entries support official and custom manufacturers, track reuse count and last-used time, and remain custom device data until catalog review approves or links them to an official model.
- Saving a custom model under an official manufacturer automatically creates one pending `switch_model_submissions` review item. Reusing the same model updates the existing personal row without duplicating the review item.
- Row-level security allows users to read and delete only their own saved models, while platform admins can inspect all saved entries in the subsequently generalized `user_device_models` table. Existing model-review approval and duplicate decisions automatically link matching personal entries to the promoted catalog model.
- Live database validation confirmed first-use persistence, automatic review capture, same-row reuse (`use_count` incremented from 1 to 2), and review deduplication. All validation rows were deleted afterward.

## Reusable Models for Infrastructure Devices

- Added and deployed migration `20260911000004_device_model_catalog.sql`, extending reusable user-added models to servers, routers, firewalls, NAS devices, storage arrays, NVRs, and UPS units while preserving the separate verified-profile workflow for switches.
- Renamed the shared personal model store to `user_device_models` and scoped uniqueness by user, device type, manufacturer, and model. Users can reuse the same model name in different equipment categories without collisions.
- Added `device_catalog_models` as the moderated public catalog for non-switch equipment. Approved models are searchable by device type and manufacturer; no unverified production models were pre-seeded.
- Each supported device modal now searches approved catalog models and the signed-in user's saved models. Manual entries can be saved once, appear as `Saved by you`, track reuse count and last-used time, and remain editable custom values until approved.
- Platform admins can inspect all pending entries in `user_device_models` and use `review_user_device_model` to approve or reject them with reviewer notes. Approval creates or reactivates the matching public catalog model and links the user's entry to it.
- Workspace device saves now retain `device_catalog_model_id` for approved non-switch models. Existing text manufacturer/model fields remain populated for compatibility and historical readability.
- Live validation created, approved, searched, and removed one fixture for each of the seven supported device types. Every type returned exactly one type-scoped catalog result, and cleanup confirmed zero remaining personal or catalog fixture rows.

## Reusable Manufacturers for Infrastructure Devices

- Added and deployed migration `20260911000005_device_brand_catalog.sql`. Servers, routers, firewalls, NAS devices, storage arrays, NVRs, and UPS units now use the same searchable manufacturer interaction as their model field instead of a one-off text input.
- Signed-in users can save a manually entered manufacturer once, find it later under `Saved by you`, and reuse it without retyping. Personal manufacturers are stored in `user_device_brands` with type-scoped uniqueness, reuse counts, and last-used timestamps.
- Added the moderated `device_catalog_brands` catalog. Platform admins can inspect all personal manufacturer entries and approve or reject them through `review_user_device_brand`, including review notes and an optional official website.
- Approved manufacturers become public search results for the matching equipment type. Saved models retain both personal and approved manufacturer references, and workspace devices retain `device_catalog_brand_id` alongside the readable manufacturer text.
- Added and deployed follow-up migration `20260911000006_fix_device_model_brand_parameters.sql` after live linkage validation exposed a PL/pgSQL parameter/column ambiguity. The corrected function was rerun successfully.
- Added and deployed migration `20260911000007_fix_switch_review_conflict.sql` after the shared function's switch regression check exposed fragile partial-index conflict inference. Targetless conflict handling now preserves review deduplication; the switch save and pending-review flow passed after the correction.
- Live validation saved and approved one manufacturer for each supported device type, confirmed exactly one type-scoped search result for each, and verified that a server model retained both manufacturer references. All manufacturer and model fixtures were removed afterward.

## Connection Point Control Alignment

- Normalized every connection-row input and select to a fixed 36px control height and added visible Category, Medium, and Direction labels so all controls share the same baseline.
- Rebalanced the desktop grid with constrained proportional columns for prefix, category, medium, direction, quantity, and delete. The delete control now aligns with the input row instead of the label row.
- Kept the existing two-column responsive layout below 940px. Browser measurements confirmed equal control heights, aligned desktop coordinates, and no horizontal modal overflow at both 1440px desktop and 390px mobile widths.
- Reduced switch connection-row density by moving Speed, PoE, and Connector behind a sliders icon beside delete. Advanced fields are closed by default and only the selected group's metadata expands.
- Collapsed switch groups now measure 52px high instead of 71.5px, while an expanded group remains independently editable. Browser validation confirmed 30px action icons, preserved metadata values, and zero horizontal overflow at 390px.

## Rear Connection and Power View

- Replaced the rear-view colour shift with a real rear equipment face showing rear-facing data ports and power sockets.
- Added a Front/Rear rack-face selector to every connection group's sliders panel. Power inputs and outputs default to Rear; network and fibre ports default to Front and can be reassigned when a model places them behind the device.
- Front and rear views now filter both ports and cable paths by physical face. Rear-view browser validation connected a PDU power output to a switch power input and rendered the power cable on the rear only.
- Added and deployed migration `20260911000008_connection_point_faces.sql` to persist connection-point face and migrate existing power points to Rear.

## Wiring Visibility Controls

- Added an always-visible wiring toolbar directly above the technical rack elevation.
- `Show wiring` displays Ethernet, fibre, and power paths. `Hide data wiring` removes blue Ethernet and cyan fibre paths while keeping power cabling visible.
- Browser validation with live rack connections confirmed the front blue cable count changed from one to zero while the rear power cable remained rendered.
- Removed visible raw endpoint IDs from cable paths because dense bundles stacked the generated identifiers over the rack. Cable details remain available as readable SVG tooltips using device and port names, such as `Switch Gi1/0/1 to Patch Panel A1`.

## Vertical Zero-U PDU Power Rails

- Added a PDU orientation selector so a PDU can remain a horizontal rack unit or become a vertical 0U power rail.
- Vertical rails can be mounted on the left or right side, render across the rack height in Rear view only, and retain selectable power sockets for cable routing.
- Vertical PDUs are excluded from rack occupancy and overlap detection. Browser validation confirmed a switch could occupy the PDU's former RU without a validation error.
- Browser validation also confirmed the rail is absent from Front view, appears on the selected left edge in Rear view, spans the full 42U rack, and exposes its power input plus 12 power outputs.
- Focused ESLint checks and the production Vite build pass. The existing bundle-size warning remains unchanged.

## Power Input and Output Sockets

- Replaced generic rectangular power ports with a dedicated three-pin socket treatment across device rear faces, horizontal PDUs, UPS units, and vertical PDU rails.
- Power inputs are orange (`#F59E0B`) to show power entering a device. Power outputs are blue (`#3B82F6`) to show power leaving a PDU or UPS.
- Power patching now accepts either selection order. Selecting a device input first and a PDU output second stores the connection canonically from output to input.
- Input-to-input and output-to-output connections remain blocked, with guidance to connect a blue power output to an orange power input.
- Browser validation confirmed the socket colours, successful input-first cabling, normalized output-to-input storage, readable cable tooltip, and rejection of an input-to-input cable.
- Fixed vertical PDUs showing only one socket when a former Network group had been converted to Power but retained its Front rack face. Vertical rails now render every configured power point, while the editor repairs power groups to Rear and keeps category, medium, and direction synchronized.
- A dedicated browser regression test confirmed a vertical PDU configured with one input and eight outputs renders all nine sockets.
