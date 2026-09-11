-- ============================================================
-- RackedView — initial schema
-- ============================================================
-- Security approach:
--   • Every table has RLS enabled, default-deny.
--   • Policies use auth.uid() – never trust client-supplied user_id.
--   • Sensitive invitation tokens are hashed; raw token never stored.
--   • All foreign keys have ON DELETE behaviour set explicitly.
--   • Timestamps managed by triggers, not the client.
-- ============================================================

-- ── extensions ────────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";
create extension if not exists "citext";
-- ── helpers ───────────────────────────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
-- ── profiles ──────────────────────────────────────────────────────────────────
-- One row per auth.users row; created automatically on signup.
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text not null check (char_length(full_name) between 1 and 200),
  avatar_url    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function set_updated_at();
alter table public.profiles enable row level security;
-- Users can read and update their own profile only.
create policy "profiles: owner read"
  on public.profiles for select
  using (id = auth.uid());
create policy "profiles: owner update"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());
-- Allow insert during signup (trigger below calls this as SECURITY DEFINER).
create policy "profiles: owner insert"
  on public.profiles for insert
  with check (id = auth.uid());
-- Auto-create a profile row when a new user signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  );
  return new;
end;
$$;
create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
-- ── organisations ─────────────────────────────────────────────────────────────
create table public.organisations (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (char_length(name) between 1 and 300),
  abn           text,                         -- validated format in app layer
  logo_url      text,
  owner_id      uuid not null references public.profiles(id) on delete restrict,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger trg_organisations_updated_at
  before update on public.organisations
  for each row execute function set_updated_at();
alter table public.organisations enable row level security;
-- ── organisation_members ──────────────────────────────────────────────────────
create type public.member_role as enum ('owner', 'admin', 'editor', 'viewer');
create type public.member_status as enum ('active', 'disabled');
create table public.organisation_members (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  role            public.member_role not null default 'viewer',
  status          public.member_status not null default 'active',
  invited_by      uuid references public.profiles(id) on delete set null,
  joined_at       timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organisation_id, user_id)
);
create index on public.organisation_members (organisation_id);
create index on public.organisation_members (user_id);
create trigger trg_organisation_members_updated_at
  before update on public.organisation_members
  for each row execute function set_updated_at();
alter table public.organisation_members enable row level security;
-- Helper: returns the calling user's role in a given organisation.
create or replace function public.my_org_role(org_id uuid)
returns public.member_role language sql security definer stable set search_path = public as $$
  select role from public.organisation_members
  where organisation_id = org_id
    and user_id = auth.uid()
    and status = 'active'
  limit 1;
$$;
-- ── RLS policies: organisations ───────────────────────────────────────────────

-- Members of an org can read it.
create policy "orgs: members read"
  on public.organisations for select
  using (
    exists (
      select 1 from public.organisation_members m
      where m.organisation_id = id
        and m.user_id = auth.uid()
        and m.status = 'active'
    )
  );
-- Any authenticated user can create an organisation.
create policy "orgs: authenticated create"
  on public.organisations for insert
  with check (auth.uid() is not null and owner_id = auth.uid());
-- Only owners/admins can update.
create policy "orgs: owner or admin update"
  on public.organisations for update
  using (public.my_org_role(id) in ('owner', 'admin'))
  with check (public.my_org_role(id) in ('owner', 'admin'));
-- Only the owner can delete.
create policy "orgs: owner delete"
  on public.organisations for delete
  using (public.my_org_role(id) = 'owner');
-- ── RLS policies: organisation_members ───────────────────────────────────────

create policy "members: org members read"
  on public.organisation_members for select
  using (
    exists (
      select 1 from public.organisation_members m2
      where m2.organisation_id = organisation_id
        and m2.user_id = auth.uid()
        and m2.status = 'active'
    )
  );
-- Only owners/admins can add members.
create policy "members: owner or admin insert"
  on public.organisation_members for insert
  with check (
    public.my_org_role(organisation_id) in ('owner', 'admin')
    -- user_id must never be forged to someone else's id
  );
-- Owner/admin can update roles (further restrictions enforced in app + trigger).
create policy "members: owner or admin update"
  on public.organisation_members for update
  using (public.my_org_role(organisation_id) in ('owner', 'admin'))
  with check (public.my_org_role(organisation_id) in ('owner', 'admin'));
-- Owner/admin can remove members.
create policy "members: owner or admin delete"
  on public.organisation_members for delete
  using (public.my_org_role(organisation_id) in ('owner', 'admin'));
-- ── organisation_invitations ──────────────────────────────────────────────────
create type public.invite_status as enum ('pending', 'accepted', 'expired', 'cancelled');
create table public.organisation_invitations (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  invited_email   citext not null,
  invited_role    public.member_role not null default 'viewer',
  token_hash      text not null unique,   -- SHA-256 hex of the raw token; raw token is never stored
  invited_by      uuid not null references public.profiles(id) on delete restrict,
  status          public.invite_status not null default 'pending',
  expires_at      timestamptz not null default (now() + interval '7 days'),
  accepted_by     uuid references public.profiles(id) on delete set null,
  accepted_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index on public.organisation_invitations (organisation_id);
create index on public.organisation_invitations (token_hash);
create index on public.organisation_invitations (invited_email);
create trigger trg_organisation_invitations_updated_at
  before update on public.organisation_invitations
  for each row execute function set_updated_at();
alter table public.organisation_invitations enable row level security;
create policy "invites: org owner or admin read"
  on public.organisation_invitations for select
  using (public.my_org_role(organisation_id) in ('owner', 'admin'));
create policy "invites: org owner or admin insert"
  on public.organisation_invitations for insert
  with check (public.my_org_role(organisation_id) in ('owner', 'admin'));
create policy "invites: org owner or admin update"
  on public.organisation_invitations for update
  using (public.my_org_role(organisation_id) in ('owner', 'admin'))
  with check (public.my_org_role(organisation_id) in ('owner', 'admin'));
-- ── sites ─────────────────────────────────────────────────────────────────────
create table public.sites (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  name            text not null check (char_length(name) between 1 and 300),
  address         text,
  notes           text,
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index on public.sites (organisation_id);
create trigger trg_sites_updated_at
  before update on public.sites
  for each row execute function set_updated_at();
alter table public.sites enable row level security;
create policy "sites: members read"
  on public.sites for select
  using (public.my_org_role(organisation_id) is not null);
create policy "sites: editor+ write"
  on public.sites for insert
  with check (public.my_org_role(organisation_id) in ('owner', 'admin', 'editor'));
create policy "sites: editor+ update"
  on public.sites for update
  using (public.my_org_role(organisation_id) in ('owner', 'admin', 'editor'))
  with check (public.my_org_role(organisation_id) in ('owner', 'admin', 'editor'));
create policy "sites: owner or admin delete"
  on public.sites for delete
  using (public.my_org_role(organisation_id) in ('owner', 'admin'));
-- ── locations ─────────────────────────────────────────────────────────────────
create table public.locations (
  id              uuid primary key default gen_random_uuid(),
  site_id         uuid not null references public.sites(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  name            text not null check (char_length(name) between 1 and 300),
  level           text,
  notes           text,
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index on public.locations (site_id);
create index on public.locations (organisation_id);
create trigger trg_locations_updated_at
  before update on public.locations
  for each row execute function set_updated_at();
alter table public.locations enable row level security;
create policy "locations: members read"
  on public.locations for select
  using (public.my_org_role(organisation_id) is not null);
create policy "locations: editor+ write"
  on public.locations for insert
  with check (public.my_org_role(organisation_id) in ('owner', 'admin', 'editor'));
create policy "locations: editor+ update"
  on public.locations for update
  using (public.my_org_role(organisation_id) in ('owner', 'admin', 'editor'))
  with check (public.my_org_role(organisation_id) in ('owner', 'admin', 'editor'));
create policy "locations: owner or admin delete"
  on public.locations for delete
  using (public.my_org_role(organisation_id) in ('owner', 'admin'));
-- ── racks ─────────────────────────────────────────────────────────────────────
create type public.ru_direction as enum ('bottom_to_top', 'top_to_bottom');
create type public.rack_doc_status as enum ('current', 'review_due', 'missing_photo', 'empty', 'archived');
create table public.racks (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  site_id         uuid not null references public.sites(id) on delete cascade,
  location_id     uuid references public.locations(id) on delete set null,
  name            text not null check (char_length(name) between 1 and 300),
  identifier      text,
  level           text,
  ru_capacity     smallint not null check (ru_capacity between 1 and 60) default 42,
  ru_direction    public.ru_direction not null default 'bottom_to_top',
  doc_status      public.rack_doc_status not null default 'empty',
  notes           text,
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index on public.racks (organisation_id);
create index on public.racks (site_id);
create index on public.racks (location_id);
create trigger trg_racks_updated_at
  before update on public.racks
  for each row execute function set_updated_at();
alter table public.racks enable row level security;
create policy "racks: members read"
  on public.racks for select
  using (public.my_org_role(organisation_id) is not null);
create policy "racks: editor+ write"
  on public.racks for insert
  with check (public.my_org_role(organisation_id) in ('owner', 'admin', 'editor'));
create policy "racks: editor+ update"
  on public.racks for update
  using (public.my_org_role(organisation_id) in ('owner', 'admin', 'editor'))
  with check (public.my_org_role(organisation_id) in ('owner', 'admin', 'editor'));
create policy "racks: owner or admin delete"
  on public.racks for delete
  using (public.my_org_role(organisation_id) in ('owner', 'admin'));
-- ── devices ───────────────────────────────────────────────────────────────────
create type public.device_type as enum (
  'patch_panel','network_switch','router','firewall','server','ups','pdu',
  'fibre_tray','nvr','storage_array','modem','kvm','shelf','blanking_panel',
  'cable_manager','custom'
);
create type public.device_status as enum (
  'active','spare','offline','planned','faulty','decommissioned'
);
create type public.rack_face as enum ('front', 'rear');
create table public.devices (
  id              uuid primary key default gen_random_uuid(),
  rack_id         uuid not null references public.racks(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  name            text not null check (char_length(name) between 1 and 300),
  device_type     public.device_type not null default 'custom',
  manufacturer    text,
  model           text,
  hostname        text,
  serial_number   text,
  asset_tag       text,
  ip_address      inet,
  mac_address     macaddr,
  ru_height       smallint not null check (ru_height between 1 and 60) default 1,
  starting_ru     smallint not null check (starting_ru >= 1),
  face            public.rack_face not null default 'front',
  status          public.device_status not null default 'active',
  notes           text,
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index on public.devices (rack_id);
create index on public.devices (organisation_id);
-- Covering index for IP/hostname searches (rack detail & global search).
create index on public.devices (organisation_id, ip_address);
create index on public.devices (organisation_id, hostname);
create index on public.devices (organisation_id, serial_number);
create index on public.devices (organisation_id, asset_tag);
create trigger trg_devices_updated_at
  before update on public.devices
  for each row execute function set_updated_at();
alter table public.devices enable row level security;
create policy "devices: members read"
  on public.devices for select
  using (public.my_org_role(organisation_id) is not null);
create policy "devices: editor+ write"
  on public.devices for insert
  with check (public.my_org_role(organisation_id) in ('owner', 'admin', 'editor'));
create policy "devices: editor+ update"
  on public.devices for update
  using (public.my_org_role(organisation_id) in ('owner', 'admin', 'editor'))
  with check (public.my_org_role(organisation_id) in ('owner', 'admin', 'editor'));
create policy "devices: owner or admin delete"
  on public.devices for delete
  using (public.my_org_role(organisation_id) in ('owner', 'admin'));
-- ── rack_photos ───────────────────────────────────────────────────────────────
create type public.photo_type as enum ('front','rear','side','room_overview','other');
create table public.rack_photos (
  id              uuid primary key default gen_random_uuid(),
  rack_id         uuid not null references public.racks(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  storage_path    text not null,           -- Supabase Storage object path
  photo_type      public.photo_type not null default 'front',
  is_primary      boolean not null default false,
  caption         text,
  uploaded_by     uuid references public.profiles(id) on delete set null,
  uploaded_at     timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index on public.rack_photos (rack_id);
create index on public.rack_photos (organisation_id);
-- Only one primary photo per rack.
create unique index on public.rack_photos (rack_id) where is_primary = true;
create trigger trg_rack_photos_updated_at
  before update on public.rack_photos
  for each row execute function set_updated_at();
alter table public.rack_photos enable row level security;
create policy "photos: members read"
  on public.rack_photos for select
  using (public.my_org_role(organisation_id) is not null);
create policy "photos: editor+ write"
  on public.rack_photos for insert
  with check (public.my_org_role(organisation_id) in ('owner', 'admin', 'editor'));
create policy "photos: editor+ update"
  on public.rack_photos for update
  using (public.my_org_role(organisation_id) in ('owner', 'admin', 'editor'))
  with check (public.my_org_role(organisation_id) in ('owner', 'admin', 'editor'));
create policy "photos: owner or admin delete"
  on public.rack_photos for delete
  using (public.my_org_role(organisation_id) in ('owner', 'admin'));
-- ── storage buckets ───────────────────────────────────────────────────────────
-- Bucket policies are applied via the Supabase dashboard / CLI separately.
-- Bucket names: 'org-logos', 'rack-photos', 'avatars'
-- All buckets should be private; signed URLs used for access.;
