-- Wi-Fi heat maps: a floor plan for one level of a site, with scale, walls and devices in one jsonb document.

create table public.heatmaps (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  site_id         uuid not null references public.sites (id) on delete cascade,
  level           text not null default 'Ground floor' check (char_length(btrim(level)) between 1 and 80),
  name            text not null default 'Untitled heat map' check (char_length(btrim(name)) between 1 and 120),
  data            jsonb not null default '{"version":1}'::jsonb,
  created_by      uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index on public.heatmaps (organisation_id, updated_at desc);
create index on public.heatmaps (site_id);

alter table public.heatmaps enable row level security;

create policy "heatmaps: members read" on public.heatmaps for select
  using (public.my_org_role(organisation_id) is not null);
create policy "heatmaps: editors insert" on public.heatmaps for insert
  with check (public.my_org_role(organisation_id) in ('owner', 'admin', 'editor'));
create policy "heatmaps: editors update" on public.heatmaps for update
  using (public.my_org_role(organisation_id) in ('owner', 'admin', 'editor'))
  with check (public.my_org_role(organisation_id) in ('owner', 'admin', 'editor'));
create policy "heatmaps: editors delete" on public.heatmaps for delete
  using (public.my_org_role(organisation_id) in ('owner', 'admin', 'editor'));
