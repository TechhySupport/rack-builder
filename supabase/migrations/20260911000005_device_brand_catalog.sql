create table public.device_catalog_brands (
  id uuid primary key default gen_random_uuid(),
  device_type text not null
    check (device_type in ('server', 'router', 'firewall', 'nas', 'storage', 'nvr', 'ups')),
  name text not null check (char_length(trim(name)) between 2 and 120),
  website text check (website is null or char_length(website) <= 500),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index device_catalog_brands_type_name_key
  on public.device_catalog_brands (device_type, lower(name));
create index device_catalog_brands_search_idx
  on public.device_catalog_brands (device_type, is_active, lower(name));

create trigger set_device_catalog_brands_updated_at
before update on public.device_catalog_brands
for each row execute function public.set_switch_brand_updated_at();

create table public.user_device_brands (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_type text not null
    check (device_type in ('server', 'router', 'firewall', 'nas', 'storage', 'nvr', 'ups')),
  name text not null check (char_length(trim(name)) between 2 and 120),
  catalog_brand_id uuid references public.device_catalog_brands(id) on delete set null,
  review_status public.switch_model_submission_status not null default 'pending',
  review_notes text check (review_notes is null or char_length(review_notes) <= 2000),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  use_count integer not null default 1 check (use_count >= 1),
  last_used_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index user_device_brands_owner_name_key
  on public.user_device_brands (user_id, device_type, lower(name));
create index user_device_brands_owner_recent_idx
  on public.user_device_brands (user_id, device_type, last_used_at desc);
create index user_device_brands_review_idx
  on public.user_device_brands (device_type, review_status, created_at desc);

create trigger set_user_device_brands_updated_at
before update on public.user_device_brands
for each row execute function public.set_switch_brand_updated_at();

alter table public.device_catalog_models
  add column device_catalog_brand_id uuid references public.device_catalog_brands(id) on delete set null;

alter table public.user_device_models
  add column user_device_brand_id uuid references public.user_device_brands(id) on delete set null,
  add column device_catalog_brand_id uuid references public.device_catalog_brands(id) on delete set null;

alter table public.devices
  add column device_catalog_brand_id uuid references public.device_catalog_brands(id) on delete set null;

create index device_catalog_models_brand_id_idx on public.device_catalog_models (device_catalog_brand_id);
create index devices_device_catalog_brand_id_idx on public.devices (device_catalog_brand_id);

alter table public.device_catalog_brands enable row level security;
alter table public.user_device_brands enable row level security;

create policy "Active device catalog brands are readable"
on public.device_catalog_brands for select
to anon, authenticated
using (is_active or public.is_platform_admin());

create policy "Platform admins insert device catalog brands"
on public.device_catalog_brands for insert
to authenticated
with check (public.is_platform_admin());

create policy "Platform admins update device catalog brands"
on public.device_catalog_brands for update
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

create policy "Platform admins delete device catalog brands"
on public.device_catalog_brands for delete
to authenticated
using (public.is_platform_admin());

create policy "Users read their saved device brands"
on public.user_device_brands for select
to authenticated
using (user_id = auth.uid() or public.is_platform_admin());

create policy "Users delete their saved device brands"
on public.user_device_brands for delete
to authenticated
using (user_id = auth.uid() or public.is_platform_admin());

create function public.save_user_device_brand(
  catalog_device_type text,
  manufacturer text
)
returns public.user_device_brands
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_brand public.user_device_brands%rowtype;
  normalized_manufacturer text := regexp_replace(trim(manufacturer), '\s+', ' ', 'g');
begin
  if auth.uid() is null then
    raise exception 'Sign in to save a manufacturer';
  end if;

  if catalog_device_type not in ('server', 'router', 'firewall', 'nas', 'storage', 'nvr', 'ups') then
    raise exception 'Unsupported device type';
  end if;

  if char_length(normalized_manufacturer) not between 2 and 120 then
    raise exception 'Manufacturer must be between 2 and 120 characters';
  end if;

  insert into public.user_device_brands (
    user_id,
    device_type,
    name
  )
  values (
    auth.uid(),
    catalog_device_type,
    normalized_manufacturer
  )
  on conflict (user_id, device_type, lower(name))
  do update set
    use_count = public.user_device_brands.use_count + 1,
    last_used_at = now()
  returning * into saved_brand;

  return saved_brand;
end;
$$;

create function public.search_device_catalog_brands(
  catalog_device_type text,
  search_term text default '',
  result_limit integer default 20
)
returns table (
  id uuid,
  device_type text,
  name text,
  website text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select brand.id, brand.device_type, brand.name, brand.website
  from public.device_catalog_brands brand
  where brand.device_type = catalog_device_type
    and brand.is_active
    and (
      nullif(trim(search_term), '') is null
      or brand.name ilike '%' || trim(search_term) || '%'
    )
  order by
    case
      when lower(brand.name) = lower(trim(search_term)) then 0
      when lower(brand.name) like lower(trim(search_term)) || '%' then 1
      else 2
    end,
    brand.name
  limit least(greatest(result_limit, 1), 50);
$$;

create function public.review_user_device_brand(
  saved_brand_id uuid,
  new_status public.switch_model_submission_status,
  admin_notes text default null,
  website_url text default null
)
returns public.user_device_brands
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_brand public.user_device_brands%rowtype;
  promoted_id uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'Only platform administrators can review user-added manufacturers';
  end if;

  if new_status not in ('approved', 'rejected') then
    raise exception 'Review status must be approved or rejected';
  end if;

  select * into saved_brand
  from public.user_device_brands
  where id = saved_brand_id
  for update;

  if not found then
    raise exception 'User-added manufacturer not found';
  end if;

  if new_status = 'approved' then
    insert into public.device_catalog_brands (
      device_type,
      name,
      website
    )
    values (
      saved_brand.device_type,
      saved_brand.name,
      nullif(trim(website_url), '')
    )
    on conflict (device_type, lower(name))
    do update set
      is_active = true,
      website = coalesce(excluded.website, public.device_catalog_brands.website)
    returning id into promoted_id;
  end if;

  update public.user_device_brands
  set review_status = new_status,
      review_notes = nullif(trim(admin_notes), ''),
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      catalog_brand_id = promoted_id
  where id = saved_brand_id
  returning * into saved_brand;

  return saved_brand;
end;
$$;

drop function public.save_user_device_model(text, uuid, text, text);

create function public.save_user_device_model(
  catalog_device_type text,
  switch_brand_id uuid,
  catalog_brand_id uuid,
  saved_brand_id uuid,
  manufacturer text,
  model text
)
returns public.user_device_models
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_model public.user_device_models%rowtype;
  normalized_manufacturer text := regexp_replace(trim(manufacturer), '\s+', ' ', 'g');
  normalized_model text := regexp_replace(trim(model), '\s+', ' ', 'g');
begin
  if auth.uid() is null then
    raise exception 'Sign in to save a custom device model';
  end if;

  if catalog_device_type not in ('switch', 'server', 'router', 'firewall', 'nas', 'storage', 'nvr', 'ups') then
    raise exception 'Unsupported device type';
  end if;

  if char_length(normalized_manufacturer) not between 1 and 120
    or char_length(normalized_model) not between 1 and 160
  then
    raise exception 'Enter a valid manufacturer and model';
  end if;

  if catalog_device_type = 'switch' and switch_brand_id is not null and not exists (
    select 1 from public.switch_brands where id = switch_brand_id and is_active
  ) then
    raise exception 'The selected manufacturer is unavailable';
  end if;

  if catalog_device_type <> 'switch' and catalog_brand_id is not null and not exists (
    select 1 from public.device_catalog_brands
    where id = catalog_brand_id
      and device_type = catalog_device_type
      and is_active
  ) then
    raise exception 'The selected manufacturer is unavailable';
  end if;

  if saved_brand_id is not null and not exists (
    select 1 from public.user_device_brands
    where id = saved_brand_id
      and user_id = auth.uid()
      and device_type = catalog_device_type
  ) then
    raise exception 'The saved manufacturer is unavailable';
  end if;

  insert into public.user_device_models (
    user_id,
    device_type,
    switch_brand_id,
    user_device_brand_id,
    device_catalog_brand_id,
    manufacturer_name,
    model_name
  )
  values (
    auth.uid(),
    catalog_device_type,
    case when catalog_device_type = 'switch' then switch_brand_id else null end,
    case when catalog_device_type <> 'switch' then saved_brand_id else null end,
    case when catalog_device_type <> 'switch' then catalog_brand_id else null end,
    normalized_manufacturer,
    normalized_model
  )
  on conflict (user_id, device_type, lower(manufacturer_name), lower(model_name))
  do update set
    switch_brand_id = excluded.switch_brand_id,
    user_device_brand_id = excluded.user_device_brand_id,
    device_catalog_brand_id = excluded.device_catalog_brand_id,
    use_count = public.user_device_models.use_count + 1,
    last_used_at = now()
  returning * into saved_model;

  if catalog_device_type = 'switch'
    and switch_brand_id is not null
    and not exists (
      select 1
      from public.switch_models catalog_model
      where catalog_model.switch_brand_id = switch_brand_id
        and lower(coalesce(catalog_model.sku, catalog_model.name)) = lower(normalized_model)
    )
  then
    insert into public.switch_model_submissions (
      switch_brand_id,
      model_name,
      submitted_by,
      notes
    )
    values (
      switch_brand_id,
      normalized_model,
      auth.uid(),
      'Automatically captured from a user-saved custom model.'
    )
    on conflict (switch_brand_id, lower(model_name)) where status = 'pending'
    do nothing;
  end if;

  return saved_model;
end;
$$;

revoke all on function public.save_user_device_brand(text, text) from public;
grant execute on function public.save_user_device_brand(text, text) to authenticated;
revoke all on function public.search_device_catalog_brands(text, text, integer) from public;
grant execute on function public.search_device_catalog_brands(text, text, integer) to anon, authenticated;
revoke all on function public.review_user_device_brand(uuid, public.switch_model_submission_status, text, text) from public;
grant execute on function public.review_user_device_brand(uuid, public.switch_model_submission_status, text, text) to authenticated;
revoke all on function public.save_user_device_model(text, uuid, uuid, uuid, text, text) from public;
grant execute on function public.save_user_device_model(text, uuid, uuid, uuid, text, text) to authenticated;