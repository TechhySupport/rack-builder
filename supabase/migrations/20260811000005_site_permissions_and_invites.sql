-- ============================================================
-- member_site_permissions: site-level access scoping for editors/viewers
-- accept_invitation: secure token-based org join
-- ============================================================

-- ── member_site_permissions ───────────────────────────────────────────────────
create table public.member_site_permissions (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  site_id         uuid not null references public.sites(id) on delete cascade,
  granted_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  unique (user_id, site_id)
);
create index on public.member_site_permissions (user_id, organisation_id);
create index on public.member_site_permissions (site_id);
alter table public.member_site_permissions enable row level security;
create policy "site_perms: org members read"
  on public.member_site_permissions for select
  using (public.my_org_role(organisation_id) is not null);
create policy "site_perms: owner or admin write"
  on public.member_site_permissions for insert
  with check (public.my_org_role(organisation_id) in ('owner', 'admin'));
create policy "site_perms: owner or admin delete"
  on public.member_site_permissions for delete
  using (public.my_org_role(organisation_id) in ('owner', 'admin'));
-- ── update site read/write RLS to respect site restrictions ──────────────────
-- Pattern: owner/admin see everything; editor/viewer see all sites when they
-- have no restrictions, OR only their assigned sites when restrictions exist.

drop policy "sites: members read" on public.sites;
create policy "sites: members read"
  on public.sites for select
  using (
    public.my_org_role(organisation_id) in ('owner', 'admin')
    OR (
      public.my_org_role(organisation_id) in ('editor', 'viewer')
      AND (
        NOT EXISTS (
          SELECT 1 FROM public.member_site_permissions msp
          WHERE msp.user_id = auth.uid()
            AND msp.organisation_id = organisation_id
        )
        OR EXISTS (
          SELECT 1 FROM public.member_site_permissions msp2
          WHERE msp2.user_id = auth.uid()
            AND msp2.site_id = id
        )
      )
    )
  );
-- Site write: editors restricted to their assigned sites
drop policy "sites: editor+ write" on public.sites;
create policy "sites: editor+ write"
  on public.sites for insert
  with check (
    public.my_org_role(organisation_id) in ('owner', 'admin')
    OR (
      public.my_org_role(organisation_id) = 'editor'
      AND NOT EXISTS (
        SELECT 1 FROM public.member_site_permissions msp
        WHERE msp.user_id = auth.uid()
          AND msp.organisation_id = organisation_id
      )
    )
  );
drop policy "sites: editor+ update" on public.sites;
create policy "sites: editor+ update"
  on public.sites for update
  using (
    public.my_org_role(organisation_id) in ('owner', 'admin')
    OR (
      public.my_org_role(organisation_id) = 'editor'
      AND (
        NOT EXISTS (
          SELECT 1 FROM public.member_site_permissions msp
          WHERE msp.user_id = auth.uid()
            AND msp.organisation_id = organisation_id
        )
        OR EXISTS (
          SELECT 1 FROM public.member_site_permissions msp2
          WHERE msp2.user_id = auth.uid() AND msp2.site_id = id
        )
      )
    )
  )
  with check (
    public.my_org_role(organisation_id) in ('owner', 'admin')
    OR public.my_org_role(organisation_id) = 'editor'
  );
-- Rack read: restricted to assigned sites when site restrictions exist
drop policy "racks: members read" on public.racks;
create policy "racks: members read"
  on public.racks for select
  using (
    public.my_org_role(organisation_id) in ('owner', 'admin')
    OR (
      public.my_org_role(organisation_id) in ('editor', 'viewer')
      AND (
        NOT EXISTS (
          SELECT 1 FROM public.member_site_permissions msp
          WHERE msp.user_id = auth.uid()
            AND msp.organisation_id = organisation_id
        )
        OR EXISTS (
          SELECT 1 FROM public.member_site_permissions msp2
          WHERE msp2.user_id = auth.uid() AND msp2.site_id = site_id
        )
      )
    )
  );
-- Rack write: editors restricted to assigned sites
drop policy "racks: editor+ write" on public.racks;
create policy "racks: editor+ write"
  on public.racks for insert
  with check (
    public.my_org_role(organisation_id) in ('owner', 'admin')
    OR (
      public.my_org_role(organisation_id) = 'editor'
      AND (
        NOT EXISTS (
          SELECT 1 FROM public.member_site_permissions msp
          WHERE msp.user_id = auth.uid()
            AND msp.organisation_id = organisation_id
        )
        OR EXISTS (
          SELECT 1 FROM public.member_site_permissions msp2
          WHERE msp2.user_id = auth.uid() AND msp2.site_id = site_id
        )
      )
    )
  );
drop policy "racks: editor+ update" on public.racks;
create policy "racks: editor+ update"
  on public.racks for update
  using (
    public.my_org_role(organisation_id) in ('owner', 'admin')
    OR (
      public.my_org_role(organisation_id) = 'editor'
      AND (
        NOT EXISTS (
          SELECT 1 FROM public.member_site_permissions msp
          WHERE msp.user_id = auth.uid()
            AND msp.organisation_id = organisation_id
        )
        OR EXISTS (
          SELECT 1 FROM public.member_site_permissions msp2
          WHERE msp2.user_id = auth.uid() AND msp2.site_id = site_id
        )
      )
    )
  )
  with check (public.my_org_role(organisation_id) in ('owner', 'admin', 'editor'));
-- ── accept_invitation: security definer — no RLS needed for callers ───────────
create or replace function public.accept_invitation(raw_token text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_token_hash text;
  v_invite     public.organisation_invitations%rowtype;
  v_org_name   text;
begin
  -- Reject clearly invalid inputs
  if raw_token is null or char_length(raw_token) < 10 then
    return json_build_object('error', 'Invalid invite code');
  end if;

  v_token_hash := encode(digest(raw_token, 'sha256'), 'hex');

  select * into v_invite
  from public.organisation_invitations
  where token_hash = v_token_hash
    and status = 'pending'
    and expires_at > now();

  if not found then
    return json_build_object('error', 'Invalid or expired invite code');
  end if;

  -- Insert member; silently skip if already a member
  insert into public.organisation_members
    (organisation_id, user_id, role, invited_by, status)
  values
    (v_invite.organisation_id, auth.uid(), v_invite.invited_role,
     v_invite.invited_by, 'active')
  on conflict (organisation_id, user_id) do nothing;

  -- Mark accepted
  update public.organisation_invitations
  set status = 'accepted',
      accepted_by = auth.uid(),
      accepted_at = now()
  where id = v_invite.id;

  select name into v_org_name
  from public.organisations
  where id = v_invite.organisation_id;

  return json_build_object(
    'organisation_id', v_invite.organisation_id,
    'organisation_name', v_org_name,
    'role', v_invite.invited_role::text
  );
end;
$$;
-- Allow any authenticated user to call accept_invitation
grant execute on function public.accept_invitation(text) to authenticated;
-- ── allow invitee to look up their own pending invite by email ────────────────
create policy "invites: invitee read own"
  on public.organisation_invitations for select
  using (
    public.my_org_role(organisation_id) in ('owner', 'admin')
    OR invited_email = (select email::citext from auth.users where id = auth.uid())
  );
