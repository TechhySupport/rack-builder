# 9 September 2026 - Daily Handoff

## Racked View Landing and Authentication Foundation

- Reframed the app around **Racked View**, a communication-rack planning and management SaaS, using the product direction from `rackedview.com`.
- Added the supplied Racked View logo as `public/assets/racked-view-logo.png` and use it in the landing page and authentication screen brand lockups.
- Added a responsive landing page: platform positioning, rack-builder visual, product pillars, and direct paths to sign in or create an account.
- Redesigned the public RackedView landing page from the supplied frontend design brief and reference image. It now has a premium dark infrastructure SaaS presentation with a cinematic hero, product UI mockups, feature grid, detailed rack showcase, use-case section, and closing CTA. Existing Get Started and Log in actions remain connected to their prior routes; no Supabase, database, authentication, API, or backend behavior was changed.
- Fixed landing-page scrolling. The rack builder's fixed-height global root layout is now overridden only while the public landing page is mounted, allowing the complete page to flow and scroll normally without affecting the authenticated editor.
- Made "Start building" open a guest editor with an empty 42RU rack. Guests can plan and edit their rack, but export/print actions direct them to sign in; authenticated users retain unrestricted exports.
- Rebuilt the rack editor from a cramped resizable table into clear item cards. The editor now has full-width type/label controls, visible top and bottom RU inputs, size feedback, duplicate/remove actions, and automatically places new devices in the first unused RU.
- Rebuilt the authenticated Rack Builder front end as a premium RackedView visual editor from the supplied Canva-style brief and reference. It now has a dark application header, design-tool controls, a vertical tool rail, searchable device library with category cards, a light grid canvas, and a responsive properties inspector. Device cards preserve real click-to-add and drag/drop placement into the existing rack model; no backend, Supabase, authentication, API, or persistence behavior changed.
- Completed the visual editor libraries: Wiring creates Ethernet, fibre, patch, power, and connection-line overlays; Text creates heading, subheading, label, and note objects; Shapes creates rectangles, circles, lines, and arrows; Images support local browser upload; Tools create pen/highlighter annotations and clear overlays; Templates provide visual cards that load the existing sample rack layouts. These are front-end canvas overlays and leave the existing rack persistence model unchanged.
- Fixed physical device drag and drop in the rack canvas. The drop handler now detects the SVG hardware bay under the pointer, converts that position to a snapped rack unit, shows a blue unit guide during a valid drag, rejects drops outside the rack, and adds the device at the chosen available RU.
- Added direct repositioning of placed rack devices. Hardware faceplates now show a grab cursor and can be dragged to another available rack unit; their existing item is moved in place while retaining its original height and refusing overlaps.
- Strengthened rack-device repositioning by replacing unreliable native HTML drag behavior on SVG faceplates with document-level pointer tracking. Holding, moving, and releasing a faceplate now works through standard pointer input and snaps reliably to the target RU; browser validation moved a switch from U42 to U5.
- Added explicit Cloudflare Workers static-assets deployment configuration in `wrangler.jsonc`. The Vite build output is `dist`, SPA route fallback is enabled, and `cf:dev` and `deploy` scripts now build then run Wrangler. Verified with `npx wrangler deploy --dry-run`, which read all generated static assets without requiring automatic project configuration.
- Removed the unimplemented Watch Video controls from the public landing page pending actual video content.
- Started the website-first launch: created `WEBSITE_PLANNER.md` and expanded the landing page with the RackTwin product workflow, Racked View audience fit, product workspace visual, and conversion calls to action.
- Added Supabase password recovery: users can request a reset email, arrive at a protected new-password screen, confirm the new password, and then sign in again. The project URL is configured, but the active Supabase CLI account received `403` for project `mnxdiekoaxjpwhbgkbbe`, so tables and publishable-key retrieval remain blocked until it is granted project access.
- Verified the configured browser publishable key against Supabase Auth (`200`), confirming it is the `anon` key for project `mnxdiekoaxjpwhbgkbbe`.
- Hardened recovery-link routing: reset emails now return to `?recovery=1`, which opens the choose-new-password screen immediately, while the Supabase `PASSWORD_RECOVERY` event remains as a fallback. The marker is removed after a successful password update.
- Password reset links still require `http://localhost:5174/**` to be listed under Supabase Auth Redirect URLs (plus the eventual production domain); this is controlled in the Supabase dashboard and is not available through the public browser key.
- Linked the workspace to Supabase project `mnxdiekoaxjpwhbgkbbe` through the CLI. Diagnosed the failed sign-ups as `trg_on_auth_user_created`: its profile insert used an empty name when no metadata was supplied, violating `profiles_full_name_check`. Updated `public.handle_new_user()` through the CLI to retain supplied names and fall back to `New user`; verified both guards are installed. No database reset or restart was performed.
- Added an authenticated Supabase-backed dashboard. Users now land on a sites-and-racks overview after sign-in, with live organisation/site/rack counts, recent racks, workspace onboarding for a new account, first-site creation, and a route into the existing rack builder. Verified the new-account dashboard state in the browser and rebuilt Vite's dependency cache after adding Lucide icons.
- Added API-key-free company and address search to the dashboard's Add site form using Photon and OpenStreetMap data. Suggestions automatically appear after five typed characters with a short debounce, and selecting a result fills the formatted address. Manual address entry remains available.
- Added owner/admin member management to the authenticated dashboard. It lists workspace members and lets authorized users assign admin, editor, or viewer access by email. Existing accounts are added through the protected `add_organisation_member(uuid, text, member_role)` RPC. New addresses receive a Supabase invitation email from the deployed `invite-organisation-member` Edge Function; its link opens a create-password view, and the new-user trigger grants the pending workspace role automatically. The Edge Function validates the signed-in inviter's active owner/admin role and keeps the service-role credential server-side. No database reset or restart was performed.
- Added a responsive email/password authentication screen with sign-in and account-creation modes.
- Added a session-aware root flow: unauthenticated visitors see the public site; authenticated users enter the existing rack editor. The editor header now includes sign out.
- Added the Supabase browser client, configured only from `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Created `.env` and `.env.example`, added `.env*` to `.gitignore`, and explicitly documented that service-role keys, database passwords, and tokens must never be present in a Vite/browser app.
- The supplied Supabase project ref is not available to the currently authenticated CLI account, so schema inspection was not possible. Authentication will work after a project publishable key is added locally to `.env`.
- Validated with `npm run build` successfully. Vite notes the existing bundle is above 500 kB after minification.

## Files Changed

- `src/main.jsx`
- `src/Root.jsx` (NEW)
- `src/lib/supabase.js` (NEW)
- `src/components/LandingPage.jsx` (NEW)
- `src/components/AuthPage.jsx` (NEW)
- `src/auth.css` (NEW)
- `public/assets/racked-view-logo.png` (NEW)
- `src/components/Header.jsx`
- `src/components/RackEditorTable.jsx`
- `src/App.jsx`
- `src/styles.css`
- `src/marketing.css` (NEW)
- `.env` (NEW, ignored)
- `.env.example` (NEW)
- `.gitignore`
- `index.html`
- `package.json`
- `package-lock.json`
- `instructions_MD/STYLE.md` (NEW)
- `instructions_MD/PROJECT.md` (NEW)
- `instructions_MD/PLANNER.md`
