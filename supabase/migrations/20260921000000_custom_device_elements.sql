-- ============================================================
-- Custom device elements: reusable, workspace-shared hardware
-- templates. Lets a member define hardware that isn't in the
-- built-in device library (name, rack height, and port layout)
-- once, then drag it onto any rack like a built-in device type.
-- ============================================================

create table public.custom_device_elements (
  id                uuid primary key default gen_random_uuid(),
  organisation_id   uuid not null references public.organisations(id) on delete cascade,
  name              text not null check (char_length(trim(name)) between 1 and 160),
  category          text not null default 'other'
    check (category in ('network', 'compute', 'power', 'other')),
  ru_height         smallint not null default 1 check (ru_height between 1 and 60),
  manufacturer      text check (manufacturer is null or char_length(trim(manufacturer)) <= 120),
  model             text check (model is null or char_length(trim(model)) <= 160),
  notes             text check (notes is null or char_length(notes) <= 2000),
  connection_points jsonb not null default '[]'::jsonb,
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index on public.custom_device_elements (organisation_id);
create trigger trg_custom_device_elements_updated_at
  before update on public.custom_device_elements
  for each row execute function set_updated_at();
alter table public.custom_device_elements enable row level security;
create policy "custom elements: members read"
  on public.custom_device_elements for select
  using (public.my_org_role(organisation_id) is not null);
create policy "custom elements: editor+ write"
  on public.custom_device_elements for insert
  with check (public.my_org_role(organisation_id) in ('owner', 'admin', 'editor'));
create policy "custom elements: editor+ update"
  on public.custom_device_elements for update
  using (public.my_org_role(organisation_id) in ('owner', 'admin', 'editor'))
  with check (public.my_org_role(organisation_id) in ('owner', 'admin', 'editor'));
create policy "custom elements: owner or admin delete"
  on public.custom_device_elements for delete
  using (public.my_org_role(organisation_id) in ('owner', 'admin'));
