-- Member groups: a named set of sites that can be assigned to many members.
-- Group access is applied by syncing into member_site_permissions (via_group = true),
-- so the existing site-scoped RLS on sites and racks keeps working unchanged.

alter table public.member_site_permissions add column if not exists via_group boolean not null default false;

create table public.member_groups (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  name            text not null check (char_length(btrim(name)) between 1 and 100),
  created_by      uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at      timestamptz not null default now()
);
create unique index member_groups_org_name_idx on public.member_groups (organisation_id, lower(btrim(name)));

create table public.member_group_sites (
  group_id uuid not null references public.member_groups (id) on delete cascade,
  site_id  uuid not null references public.sites (id) on delete cascade,
  primary key (group_id, site_id)
);
create index on public.member_group_sites (site_id);

create table public.member_group_members (
  group_id uuid not null references public.member_groups (id) on delete cascade,
  user_id  uuid not null references public.profiles (id) on delete cascade,
  primary key (group_id, user_id)
);
create index on public.member_group_members (user_id);

alter table public.member_groups enable row level security;
alter table public.member_group_sites enable row level security;
alter table public.member_group_members enable row level security;

create policy "groups: members read" on public.member_groups for select
  using (public.my_org_role(organisation_id) is not null);
create policy "groups: owner or admin insert" on public.member_groups for insert
  with check (public.my_org_role(organisation_id) in ('owner', 'admin'));
create policy "groups: owner or admin update" on public.member_groups for update
  using (public.my_org_role(organisation_id) in ('owner', 'admin'))
  with check (public.my_org_role(organisation_id) in ('owner', 'admin'));
create policy "groups: owner or admin delete" on public.member_groups for delete
  using (public.my_org_role(organisation_id) in ('owner', 'admin'));

create policy "group sites: members read" on public.member_group_sites for select
  using (exists (
    select 1 from public.member_groups g
    where g.id = member_group_sites.group_id and public.my_org_role(g.organisation_id) is not null
  ));
create policy "group sites: owner or admin insert" on public.member_group_sites for insert
  with check (exists (
    select 1 from public.member_groups g
    join public.sites s on s.organisation_id = g.organisation_id
    where g.id = member_group_sites.group_id
      and s.id = member_group_sites.site_id
      and public.my_org_role(g.organisation_id) in ('owner', 'admin')
  ));
create policy "group sites: owner or admin delete" on public.member_group_sites for delete
  using (exists (
    select 1 from public.member_groups g
    where g.id = member_group_sites.group_id and public.my_org_role(g.organisation_id) in ('owner', 'admin')
  ));

create policy "group members: members read" on public.member_group_members for select
  using (exists (
    select 1 from public.member_groups g
    where g.id = member_group_members.group_id and public.my_org_role(g.organisation_id) is not null
  ));
create policy "group members: owner or admin insert" on public.member_group_members for insert
  with check (exists (
    select 1 from public.member_groups g
    join public.organisation_members m on m.organisation_id = g.organisation_id
    where g.id = member_group_members.group_id
      and m.user_id = member_group_members.user_id
      and public.my_org_role(g.organisation_id) in ('owner', 'admin')
  ));
create policy "group members: owner or admin delete" on public.member_group_members for delete
  using (exists (
    select 1 from public.member_groups g
    where g.id = member_group_members.group_id and public.my_org_role(g.organisation_id) in ('owner', 'admin')
  ));

-- Rebuilds the group-derived site permissions for one user; direct permissions are never touched.
create or replace function public.sync_group_site_permissions(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.member_site_permissions where user_id = p_user and via_group;
  insert into public.member_site_permissions (organisation_id, user_id, site_id, granted_by, via_group)
  select distinct g.organisation_id, gm.user_id, gs.site_id, auth.uid(), true
  from public.member_group_members gm
  join public.member_groups g on g.id = gm.group_id
  join public.member_group_sites gs on gs.group_id = g.id
  where gm.user_id = p_user
  on conflict (user_id, site_id) do nothing;
end;
$$;

create or replace function public.trg_sync_group_members()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.sync_group_site_permissions(coalesce(new.user_id, old.user_id));
  return null;
end;
$$;

create or replace function public.trg_sync_group_sites()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
begin
  for v_user in select user_id from public.member_group_members where group_id = coalesce(new.group_id, old.group_id) loop
    perform public.sync_group_site_permissions(v_user);
  end loop;
  return null;
end;
$$;

create or replace function public.trg_drop_group_membership_on_leave()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.member_group_members
  where user_id = old.user_id
    and group_id in (select id from public.member_groups where organisation_id = old.organisation_id);
  return null;
end;
$$;

create trigger trg_group_members_sync
  after insert or delete on public.member_group_members
  for each row execute function public.trg_sync_group_members();
create trigger trg_group_sites_sync
  after insert or delete on public.member_group_sites
  for each row execute function public.trg_sync_group_sites();
create trigger trg_org_member_leave_groups
  after delete on public.organisation_members
  for each row execute function public.trg_drop_group_membership_on_leave();
