-- Designs become private to their creator (and organisation owners/admins) until shared.
-- A share grants one organisation member either view-only or edit access to one design.

create table public.design_shares (
  design_id  uuid not null references public.designs (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  permission text not null default 'view' check (permission in ('view', 'edit')),
  shared_by  uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (design_id, user_id)
);
create index on public.design_shares (user_id);

-- Helpers are security definer so the designs and design_shares policies cannot recurse into each other.
create or replace function public.design_manages(p_design uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.designs d
    where d.id = p_design
      and public.my_org_role(d.organisation_id) is not null
      and (d.created_by = auth.uid() or public.my_org_role(d.organisation_id) in ('owner', 'admin'))
  );
$$;

create or replace function public.design_can_view(p_design uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.design_manages(p_design) or exists (
    select 1 from public.design_shares s
    join public.designs d on d.id = s.design_id
    where s.design_id = p_design and s.user_id = auth.uid()
      and public.my_org_role(d.organisation_id) is not null
  );
$$;

create or replace function public.design_can_edit(p_design uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.designs d
    where d.id = p_design and public.design_manages(p_design)
      and public.my_org_role(d.organisation_id) in ('owner', 'admin', 'editor')
  ) or exists (
    select 1 from public.design_shares s
    join public.designs d on d.id = s.design_id
    where s.design_id = p_design and s.user_id = auth.uid() and s.permission = 'edit'
      and public.my_org_role(d.organisation_id) is not null
  );
$$;

create or replace function public.design_org_has_member(p_design uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.designs d
    join public.organisation_members m on m.organisation_id = d.organisation_id
    where d.id = p_design and m.user_id = p_user and m.status = 'active'
  );
$$;

drop policy "designs: members read" on public.designs;
drop policy "designs: editors update" on public.designs;
drop policy "designs: editors delete" on public.designs;

-- The creator test is inline so INSERT ... RETURNING can read the row it just wrote.
create policy "designs: creator, admins and shared members read" on public.designs for select
  using ((created_by = auth.uid() and public.my_org_role(organisation_id) is not null) or public.design_can_view(id));
create policy "designs: edit access update" on public.designs for update
  using (public.design_can_edit(id))
  with check (public.my_org_role(organisation_id) is not null);
create policy "designs: creator and admins delete" on public.designs for delete
  using (public.design_manages(id));

alter table public.design_shares enable row level security;

create policy "design shares: read own or managed" on public.design_shares for select
  using (user_id = auth.uid() or public.design_manages(design_id));
create policy "design shares: managers add" on public.design_shares for insert
  with check (public.design_manages(design_id) and public.design_org_has_member(design_id, user_id));
create policy "design shares: managers change" on public.design_shares for update
  using (public.design_manages(design_id))
  with check (public.design_manages(design_id));
create policy "design shares: managers remove or leave" on public.design_shares for delete
  using (public.design_manages(design_id) or user_id = auth.uid());
