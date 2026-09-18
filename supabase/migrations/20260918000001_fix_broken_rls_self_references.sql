-- ============================================================
-- Fix self-referential RLS bugs (e.g. `m.organisation_id = m.id`
-- instead of `m.organisation_id = organisations.id`) that silently
-- blocked non-owner members from ever seeing their organisation,
-- and simplify the sites policies to match the already-fixed racks
-- pattern (dropping the unused/broken site-permission scoping).
-- ============================================================

-- ── organisations: members read ───────────────────────────────────────────────
-- This was always false for every row, since it compared organisation_members
-- to itself instead of to the organisations row being checked. This meant
-- editors/viewers/non-owner admins could never see their own organisation.
drop policy if exists "orgs: members read" on public.organisations;
create policy "orgs: members read"
  on public.organisations for select
  using (
    exists (
      select 1 from public.organisation_members m
      where m.organisation_id = organisations.id
        and m.user_id = auth.uid()
        and m.status = 'active'
    )
  );

-- ── sites: members read / editor+ update ──────────────────────────────────────
-- Same self-referential bug pattern as the old racks policies
-- (msp.organisation_id = msp.organisation_id, msp2.site_id = msp2.id).
-- Simplify to a plain role check, matching the fixed racks policy.
drop policy if exists "sites: members read" on public.sites;
create policy "sites: members read"
  on public.sites for select
  using (
    my_org_role(organisation_id) = ANY (ARRAY['owner'::member_role, 'admin'::member_role, 'editor'::member_role, 'viewer'::member_role])
  );

drop policy if exists "sites: editor+ update" on public.sites;
create policy "sites: editor+ update"
  on public.sites for update
  using (
    my_org_role(organisation_id) = ANY (ARRAY['owner'::member_role, 'admin'::member_role, 'editor'::member_role])
  )
  with check (
    my_org_role(organisation_id) = ANY (ARRAY['owner'::member_role, 'admin'::member_role, 'editor'::member_role])
  );
