create type public.switch_model_catalog_level as enum ('family', 'exact_sku');
create type public.connection_profile_status as enum ('draft', 'verified', 'retired');
create type public.connection_point_category as enum ('network', 'wan', 'fibre', 'power_input', 'power_output', 'other');
create type public.connection_point_medium as enum ('copper', 'fibre', 'power', 'other');
create type public.connection_point_direction as enum ('input', 'output', 'bidirectional');
create type public.poe_capability as enum ('none', 'poe', 'poe_plus', 'poe_plus_plus', 'pass_through', 'unknown');

alter table public.switch_models
  add column catalog_level public.switch_model_catalog_level not null default 'family',
  add column sku text check (sku is null or char_length(trim(sku)) between 1 and 160),
  add column parent_model_id uuid references public.switch_models(id) on delete set null;

alter table public.switch_models
  add constraint switch_models_exact_sku_check check (
    (catalog_level = 'family' and sku is null)
    or (catalog_level = 'exact_sku' and sku is not null)
  );

create unique index switch_models_brand_sku_lower_key
  on public.switch_models (switch_brand_id, lower(sku))
  where sku is not null;
create index switch_models_parent_model_idx on public.switch_models (parent_model_id);

create table public.switch_model_connection_profiles (
  id uuid primary key default gen_random_uuid(),
  switch_model_id uuid not null references public.switch_models(id) on delete cascade,
  version integer not null check (version >= 1),
  status public.connection_profile_status not null default 'draft',
  source_url text check (source_url is null or char_length(source_url) <= 1000),
  source_notes text check (source_notes is null or char_length(source_notes) <= 2000),
  verified_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (switch_model_id, version),
  constraint switch_model_profile_verification_check check (
    status <> 'verified'
    or (source_url is not null and verified_at is not null)
  )
);

create index switch_model_profiles_model_status_idx
  on public.switch_model_connection_profiles (switch_model_id, status, version desc);

create table public.switch_model_connection_templates (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.switch_model_connection_profiles(id) on delete cascade,
  template_key text not null check (template_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name_pattern text not null check (char_length(trim(name_pattern)) between 1 and 160),
  category public.connection_point_category not null,
  medium public.connection_point_medium not null,
  direction public.connection_point_direction not null,
  quantity integer not null check (quantity between 1 and 1024),
  start_index integer not null default 1 check (start_index >= 0),
  append_index boolean not null default true,
  speed_mbps integer check (speed_mbps is null or speed_mbps > 0),
  poe public.poe_capability not null default 'unknown',
  connector_type text check (connector_type is null or char_length(trim(connector_type)) between 1 and 80),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, template_key),
  unique (profile_id, sort_order)
);

create index switch_model_templates_profile_idx
  on public.switch_model_connection_templates (profile_id, sort_order);

alter table public.switch_models
  add column active_connection_profile_id uuid references public.switch_model_connection_profiles(id) on delete set null;

alter table public.devices
  add column connection_profile_id uuid references public.switch_model_connection_profiles(id) on delete set null,
  add column connection_profile_version integer check (connection_profile_version is null or connection_profile_version >= 1),
  add column connection_points_customized boolean not null default false;

alter table public.devices
  add constraint devices_id_organisation_key unique (id, organisation_id);

create table public.device_connection_points (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  device_id uuid not null,
  client_point_id text not null check (char_length(client_point_id) between 1 and 200),
  name text not null check (char_length(trim(name)) between 1 and 200),
  name_pattern text check (name_pattern is null or char_length(trim(name_pattern)) between 1 and 160),
  category public.connection_point_category not null,
  medium public.connection_point_medium not null,
  direction public.connection_point_direction not null,
  speed_mbps integer check (speed_mbps is null or speed_mbps > 0),
  poe public.poe_capability not null default 'unknown',
  connector_type text check (connector_type is null or char_length(trim(connector_type)) between 1 and 80),
  source_template_id uuid references public.switch_model_connection_templates(id) on delete set null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (device_id, organisation_id) references public.devices(id, organisation_id) on delete cascade,
  unique (device_id, client_point_id)
);

create index device_connection_points_org_idx on public.device_connection_points (organisation_id);
create index device_connection_points_device_idx on public.device_connection_points (device_id, sort_order);

create trigger set_switch_model_profiles_updated_at
before update on public.switch_model_connection_profiles
for each row execute function public.set_switch_brand_updated_at();

create trigger set_switch_model_templates_updated_at
before update on public.switch_model_connection_templates
for each row execute function public.set_switch_brand_updated_at();

create trigger set_device_connection_points_updated_at
before update on public.device_connection_points
for each row execute function public.set_switch_brand_updated_at();

create or replace function public.validate_switch_model_profile_assignment()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.parent_model_id is not null and not exists (
    select 1
    from public.switch_models parent
    where parent.id = new.parent_model_id
      and parent.switch_brand_id = new.switch_brand_id
      and parent.catalog_level = 'family'
  ) then
    raise exception 'Parent model must be a family from the same manufacturer';
  end if;

  if new.active_connection_profile_id is not null and not exists (
    select 1
    from public.switch_model_connection_profiles profile
    where profile.id = new.active_connection_profile_id
      and profile.switch_model_id = new.id
      and profile.status = 'verified'
  ) then
    raise exception 'Active connection profile must be a verified profile for this exact model';
  end if;

  if new.active_connection_profile_id is not null and new.catalog_level <> 'exact_sku' then
    raise exception 'Only exact SKU models can have an active connection profile';
  end if;

  return new;
end;
$$;

create trigger validate_switch_model_profile_assignment
before insert or update of active_connection_profile_id, catalog_level, parent_model_id, switch_brand_id
on public.switch_models
for each row execute function public.validate_switch_model_profile_assignment();

create or replace function public.validate_exact_model_connection_profile()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.switch_models model
    where model.id = new.switch_model_id
      and model.catalog_level = 'exact_sku'
  ) then
    raise exception 'Connection profiles can only belong to exact SKU models';
  end if;
  return new;
end;
$$;

create trigger validate_exact_model_connection_profile
before insert or update of switch_model_id
on public.switch_model_connection_profiles
for each row execute function public.validate_exact_model_connection_profile();

alter table public.switch_model_connection_profiles enable row level security;
alter table public.switch_model_connection_templates enable row level security;
alter table public.device_connection_points enable row level security;

create policy "Verified switch connection profiles are readable"
on public.switch_model_connection_profiles for select
to anon, authenticated
using (status = 'verified' or public.is_platform_admin());

create policy "Platform admins insert switch connection profiles"
on public.switch_model_connection_profiles for insert
to authenticated
with check (public.is_platform_admin());

create policy "Platform admins update switch connection profiles"
on public.switch_model_connection_profiles for update
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

create policy "Platform admins delete switch connection profiles"
on public.switch_model_connection_profiles for delete
to authenticated
using (public.is_platform_admin());

create policy "Verified switch connection templates are readable"
on public.switch_model_connection_templates for select
to anon, authenticated
using (
  exists (
    select 1
    from public.switch_model_connection_profiles profile
    where profile.id = profile_id
      and (profile.status = 'verified' or public.is_platform_admin())
  )
);

create policy "Platform admins insert switch connection templates"
on public.switch_model_connection_templates for insert
to authenticated
with check (public.is_platform_admin());

create policy "Platform admins update switch connection templates"
on public.switch_model_connection_templates for update
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

create policy "Platform admins delete switch connection templates"
on public.switch_model_connection_templates for delete
to authenticated
using (public.is_platform_admin());

create policy "Device connection points are readable by members"
on public.device_connection_points for select
to authenticated
using (public.my_org_role(organisation_id) is not null);

create policy "Device connection points are writable by editors"
on public.device_connection_points for insert
to authenticated
with check (public.my_org_role(organisation_id) in ('owner', 'admin', 'editor'));

create policy "Device connection points are editable by editors"
on public.device_connection_points for update
to authenticated
using (public.my_org_role(organisation_id) in ('owner', 'admin', 'editor'))
with check (public.my_org_role(organisation_id) in ('owner', 'admin', 'editor'));

create policy "Device connection points are removable by editors"
on public.device_connection_points for delete
to authenticated
using (public.my_org_role(organisation_id) in ('owner', 'admin', 'editor'));

drop function public.search_switch_models(uuid, text, integer);

create function public.search_switch_models(
  brand_id uuid,
  search_term text default '',
  result_limit integer default 20
)
returns table (
  id uuid,
  switch_brand_id uuid,
  name text,
  slug text,
  product_family text,
  catalog_level public.switch_model_catalog_level,
  sku text,
  active_connection_profile_id uuid,
  connection_profile_version integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    model.id,
    model.switch_brand_id,
    model.name,
    model.slug,
    model.product_family,
    model.catalog_level,
    model.sku,
    model.active_connection_profile_id,
    profile.version
  from public.switch_models model
  left join public.switch_model_connection_profiles profile
    on profile.id = model.active_connection_profile_id
    and profile.status = 'verified'
  where model.switch_brand_id = brand_id
    and model.is_active
    and (
      nullif(trim(search_term), '') is null
      or model.name ilike '%' || trim(search_term) || '%'
      or model.sku ilike '%' || trim(search_term) || '%'
      or model.product_family ilike '%' || trim(search_term) || '%'
    )
  order by
    case
      when lower(coalesce(model.sku, model.name)) = lower(trim(search_term)) then 0
      when lower(coalesce(model.sku, model.name)) like lower(trim(search_term)) || '%' then 1
      when lower(model.name) like lower(trim(search_term)) || '%' then 2
      when lower(coalesce(model.product_family, '')) like lower(trim(search_term)) || '%' then 3
      else 4
    end,
    model.name
  limit least(greatest(result_limit, 1), 50);
$$;

create or replace function public.get_switch_model_connection_profile(model_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'id', profile.id,
    'model_id', profile.switch_model_id,
    'version', profile.version,
    'source_url', profile.source_url,
    'verified_at', profile.verified_at,
    'groups', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', template.id,
          'template_key', template.template_key,
          'name_pattern', template.name_pattern,
          'category', template.category,
          'medium', template.medium,
          'direction', template.direction,
          'quantity', template.quantity,
          'start_index', template.start_index,
          'append_index', template.append_index,
          'speed_mbps', template.speed_mbps,
          'poe', template.poe,
          'connector_type', template.connector_type,
          'sort_order', template.sort_order
        ) order by template.sort_order
      ) filter (where template.id is not null),
      '[]'::jsonb
    )
  )
  from public.switch_models model
  join public.switch_model_connection_profiles profile
    on profile.id = model.active_connection_profile_id
    and profile.status = 'verified'
  left join public.switch_model_connection_templates template
    on template.profile_id = profile.id
  where model.id = model_id
    and model.catalog_level = 'exact_sku'
    and model.is_active
  group by profile.id;
$$;

revoke all on function public.search_switch_models(uuid, text, integer) from public;
grant execute on function public.search_switch_models(uuid, text, integer) to anon, authenticated;
revoke all on function public.get_switch_model_connection_profile(uuid) from public;
grant execute on function public.get_switch_model_connection_profile(uuid) to anon, authenticated;