-- ============================================================
-- Correctly re-implement site-scoped access for editors/viewers.
-- A member with zero member_site_permissions rows for an org is
-- unrestricted (sees everything, current behaviour). A member with
-- at least one row for that org is restricted to only their
-- assigned sites (and racks within those sites).
-- Fixes the same self-referential bug class as before, this time
-- correctly comparing to the OUTER row (sites.id / sites.organisation_id
-- / racks.site_id), not the permissions table compared to itself.
-- ============================================================

drop policy if exists "sites: members read" on public.sites;
create policy "sites: members read"
  on public.sites for select
  using (
    my_org_role(organisation_id) in ('owner', 'admin')
    OR (
      my_org_role(organisation_id) in ('editor', 'viewer')
      AND (
        NOT EXISTS (
          SELECT 1 FROM public.member_site_permissions msp
          WHERE msp.user_id = auth.uid() AND msp.organisation_id = sites.organisation_id
        )
        OR EXISTS (
          SELECT 1 FROM public.member_site_permissions msp2
          WHERE msp2.user_id = auth.uid() AND msp2.site_id = sites.id
        )
      )
    )
  );

drop policy if exists "sites: editor+ update" on public.sites;
create policy "sites: editor+ update"
  on public.sites for update
  using (
    my_org_role(organisation_id) in ('owner', 'admin')
    OR (
      my_org_role(organisation_id) = 'editor'
      AND (
        NOT EXISTS (
          SELECT 1 FROM public.member_site_permissions msp
          WHERE msp.user_id = auth.uid() AND msp.organisation_id = sites.organisation_id
        )
        OR EXISTS (
          SELECT 1 FROM public.member_site_permissions msp2
          WHERE msp2.user_id = auth.uid() AND msp2.site_id = sites.id
        )
      )
    )
  )
  with check (my_org_role(organisation_id) in ('owner', 'admin', 'editor'));

drop policy if exists "racks: members read" on public.racks;
create policy "racks: members read"
  on public.racks for select
  using (
    my_org_role(organisation_id) in ('owner', 'admin')
    OR (
      my_org_role(organisation_id) in ('editor', 'viewer')
      AND (
        NOT EXISTS (
          SELECT 1 FROM public.member_site_permissions msp
          WHERE msp.user_id = auth.uid() AND msp.organisation_id = racks.organisation_id
        )
        OR EXISTS (
          SELECT 1 FROM public.member_site_permissions msp2
          WHERE msp2.user_id = auth.uid() AND msp2.site_id = racks.site_id
        )
      )
    )
  );

drop policy if exists "racks: editor+ write" on public.racks;
create policy "racks: editor+ write"
  on public.racks for insert
  with check (
    my_org_role(organisation_id) in ('owner', 'admin')
    OR (
      my_org_role(organisation_id) = 'editor'
      AND (
        NOT EXISTS (
          SELECT 1 FROM public.member_site_permissions msp
          WHERE msp.user_id = auth.uid() AND msp.organisation_id = racks.organisation_id
        )
        OR EXISTS (
          SELECT 1 FROM public.member_site_permissions msp2
          WHERE msp2.user_id = auth.uid() AND msp2.site_id = racks.site_id
        )
      )
    )
  );

drop policy if exists "racks: editor+ update" on public.racks;
create policy "racks: editor+ update"
  on public.racks for update
  using (
    my_org_role(organisation_id) in ('owner', 'admin')
    OR (
      my_org_role(organisation_id) = 'editor'
      AND (
        NOT EXISTS (
          SELECT 1 FROM public.member_site_permissions msp
          WHERE msp.user_id = auth.uid() AND msp.organisation_id = racks.organisation_id
        )
        OR EXISTS (
          SELECT 1 FROM public.member_site_permissions msp2
          WHERE msp2.user_id = auth.uid() AND msp2.site_id = racks.site_id
        )
      )
    )
  )
  with check (my_org_role(organisation_id) in ('owner', 'admin', 'editor'));
