-- Design canvases: free-form network drawings, optionally drawn over an imported rack picture.
-- The drawing (elements, embedded image) lives in one jsonb document.

create table public.designs (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  name            text not null default 'Untitled design' check (char_length(btrim(name)) between 1 and 120),
  data            jsonb not null default '{"version":1,"elements":[]}'::jsonb,
  created_by      uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index on public.designs (organisation_id, updated_at desc);

alter table public.designs enable row level security;

create policy "designs: members read" on public.designs for select
  using (public.my_org_role(organisation_id) is not null);
create policy "designs: editors insert" on public.designs for insert
  with check (public.my_org_role(organisation_id) in ('owner', 'admin', 'editor'));
create policy "designs: editors update" on public.designs for update
  using (public.my_org_role(organisation_id) in ('owner', 'admin', 'editor'))
  with check (public.my_org_role(organisation_id) in ('owner', 'admin', 'editor'));
create policy "designs: editors delete" on public.designs for delete
  using (public.my_org_role(organisation_id) in ('owner', 'admin', 'editor'));
