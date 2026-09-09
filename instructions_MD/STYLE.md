# Rack Builder — Style Preferences

## Code style

- React function components with hooks (`useState`, `useRef`, `useCallback`, `useEffect`) — no class components.
- Section dividers in JS/CSS use the `// ── Label ──...` / `/* ── Label ── */` comment banner style already present in [App.jsx](../src/App.jsx) and [styles.css](../src/styles.css). Keep using it for new sections.
- One component per file in `src/components`, PascalCase filenames matching the exported component (e.g. `RackEditorTable.jsx`).
- Persisted state (racks, active index) goes through `localStorage` with a `try/catch` guard — follow the existing `STORAGE_KEY_*` pattern in [App.jsx](../src/App.jsx).
- ESLint: `no-unused-vars` allows constants matching `^[A-Z_]`. Keep exports/consts that intentionally look unused named accordingly.
- Comments should explain *why*, not restate the next line. Keep them to one short line.

## CSS / visual style

- All styling lives in [styles.css](../src/styles.css) (plus [App.css](../src/App.css) / [index.css](../src/index.css) for Vite defaults) using CSS custom properties defined in `:root` — palette, spacing (`--sp-*`), radius (`--r-*`), shadows, and layout heights. Reuse existing tokens instead of hard-coding new values.
- Font stack: system font (`-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, ...`). No custom web fonts.
- Current palette is light-mode only (`--bg`, `--surface`, `--border`, `--brand`, etc.). If dark mode is introduced, prefer adaptive/system-driven tokens over hard-coded solid colors, and re-theme via CSS variables rather than per-component overrides.
- Status colors follow a paired `--ok/--ok-bg`, `--warn/--warn-bg`, `--err/--err-bg` convention — reuse this pairing for any new status states.
- No emojis in UI text, labels, or copy unless explicitly requested.
- Enterprise-grade, clean, minimal aesthetic — avoid decorative flourishes not already established in the existing panels (Header, Toolbar, RackEditorTable, etc.).

## Documentation style

- Daily/feature handoffs go in `instructions_MD/` as dated or topic-named markdown files, mirroring the convention used in the SubbedInn project (`/Users/maiklmansour/App/SubbedInn/src/instructions_MD/`).
- Each handoff documents what was implemented/fixed and lists files changed.
- Do not create ad-hoc markdown files outside `instructions_MD/` unless requested.
