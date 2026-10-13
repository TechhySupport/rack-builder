-- Heat maps follow the design sharing model: private to the creator (and organisation owners/admins)
-- until shared with a member, plus optional public read-only viewer links.

create table public.heatmap_shares (
  heatmap_id uuid not null references public.heatmaps (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  permission text not null default 'view' check (permission in ('view', 'edit')),
  shared_by  uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (heatmap_id, user_id)
);
create index on public.heatmap_shares (user_id);

create or replace function public.heatmap_manages(p_heatmap uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.heatmaps h
    where h.id = p_heatmap
      and public.my_org_role(h.organisation_id) is not null
      and (h.created_by = auth.uid() or public.my_org_role(h.organisation_id) in ('owner', 'admin'))
  );
$$;

create or replace function public.heatmap_can_view(p_heatmap uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.heatmap_manages(p_heatmap) or exists (
    select 1 from public.heatmap_shares s
    join public.heatmaps h on h.id = s.heatmap_id
    where s.heatmap_id = p_heatmap and s.user_id = auth.uid()
      and public.my_org_role(h.organisation_id) is not null
  );
$$;

create or replace function public.heatmap_can_edit(p_heatmap uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.heatmaps h
    where h.id = p_heatmap and public.heatmap_manages(p_heatmap)
      and public.my_org_role(h.organisation_id) in ('owner', 'admin', 'editor')
  ) or exists (
    select 1 from public.heatmap_shares s
    join public.heatmaps h on h.id = s.heatmap_id
    where s.heatmap_id = p_heatmap and s.user_id = auth.uid() and s.permission = 'edit'
      and public.my_org_role(h.organisation_id) is not null
  );
$$;

create or replace function public.heatmap_org_has_member(p_heatmap uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.heatmaps h
    join public.organisation_members m on m.organisation_id = h.organisation_id
    where h.id = p_heatmap and m.user_id = p_user and m.status = 'active'
  );
$$;

drop policy "heatmaps: members read" on public.heatmaps;
drop policy "heatmaps: editors update" on public.heatmaps;
drop policy "heatmaps: editors delete" on public.heatmaps;

-- The creator test is inline so INSERT ... RETURNING can read the row it just wrote.
create policy "heatmaps: creator, admins and shared members read" on public.heatmaps for select
  using ((created_by = auth.uid() and public.my_org_role(organisation_id) is not null) or public.heatmap_can_view(id));
create policy "heatmaps: edit access update" on public.heatmaps for update
  using (public.heatmap_can_edit(id))
  with check (public.my_org_role(organisation_id) is not null);
create policy "heatmaps: creator and admins delete" on public.heatmaps for delete
  using (public.heatmap_manages(id));

alter table public.heatmap_shares enable row level security;

create policy "heatmap shares: read own or managed" on public.heatmap_shares for select
  using (user_id = auth.uid() or public.heatmap_manages(heatmap_id));
create policy "heatmap shares: managers add" on public.heatmap_shares for insert
  with check (public.heatmap_manages(heatmap_id) and public.heatmap_org_has_member(heatmap_id, user_id));
create policy "heatmap shares: managers change" on public.heatmap_shares for update
  using (public.heatmap_manages(heatmap_id))
  with check (public.heatmap_manages(heatmap_id));
create policy "heatmap shares: managers remove or leave" on public.heatmap_shares for delete
  using (public.heatmap_manages(heatmap_id) or user_id = auth.uid());

-- Public read-only viewer links: /heatmap-viewer/<token>.
create table public.heatmap_links (
  heatmap_id uuid primary key references public.heatmaps (id) on delete cascade,
  token      text not null unique default replace(gen_random_uuid()::text, '-', ''),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

alter table public.heatmap_links enable row level security;

create policy "heatmap links: managers read" on public.heatmap_links for select
  using (public.heatmap_manages(heatmap_id));
create policy "heatmap links: managers create" on public.heatmap_links for insert
  with check (public.heatmap_manages(heatmap_id));
create policy "heatmap links: managers delete" on public.heatmap_links for delete
  using (public.heatmap_manages(heatmap_id));

-- Anonymous visitors cannot read tables; this exposes only the name and plan for a valid token.
create or replace function public.get_heatmap_by_token(p_token text)
returns table (name text, data jsonb, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select h.name, h.data, h.updated_at
  from public.heatmap_links l
  join public.heatmaps h on h.id = l.heatmap_id
  where l.token = p_token;
$$;

revoke all on function public.get_heatmap_by_token(text) from public;
grant execute on function public.get_heatmap_by_token(text) to anon, authenticated;
