alter table public.user_switch_models rename to user_device_models;

alter table public.user_device_models
  add column device_type text not null default 'switch'
    check (device_type in ('switch', 'server', 'router', 'firewall', 'nas', 'storage', 'nvr', 'ups')),
  add column review_status public.switch_model_submission_status not null default 'pending',
  add column review_notes text check (review_notes is null or char_length(review_notes) <= 2000),
  add column reviewed_by uuid references auth.users(id) on delete set null,
  add column reviewed_at timestamptz;

drop index public.user_switch_models_owner_name_key;
create unique index user_device_models_owner_name_key
  on public.user_device_models (user_id, device_type, lower(manufacturer_name), lower(model_name));
alter index public.user_switch_models_owner_recent_idx rename to user_device_models_owner_recent_idx;
alter index public.user_switch_models_review_idx rename to user_device_models_review_idx;

drop trigger set_user_switch_models_updated_at on public.user_device_models;
create trigger set_user_device_models_updated_at
before update on public.user_device_models
for each row execute function public.set_switch_brand_updated_at();

create table public.device_catalog_models (
  id uuid primary key default gen_random_uuid(),
  device_type text not null
    check (device_type in ('server', 'router', 'firewall', 'nas', 'storage', 'nvr', 'ups')),
  manufacturer_name text not null check (char_length(trim(manufacturer_name)) between 1 and 120),
  model_name text not null check (char_length(trim(model_name)) between 1 and 160),
  product_family text check (product_family is null or char_length(trim(product_family)) between 1 and 120),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index device_catalog_models_type_name_key
  on public.device_catalog_models (device_type, lower(manufacturer_name), lower(model_name));
create index device_catalog_models_search_idx
  on public.device_catalog_models (device_type, lower(manufacturer_name), is_active);

create trigger set_device_catalog_models_updated_at
before update on public.device_catalog_models
for each row execute function public.set_switch_brand_updated_at();

alter table public.user_device_models
  add column catalog_model_id uuid references public.device_catalog_models(id) on delete set null;

alter table public.devices
  add column device_catalog_model_id uuid references public.device_catalog_models(id) on delete set null;

create index devices_device_catalog_model_id_idx on public.devices (device_catalog_model_id);

alter table public.device_catalog_models enable row level security;

create policy "Active device catalog models are readable"
on public.device_catalog_models for select
to anon, authenticated
using (is_active or public.is_platform_admin());

create policy "Platform admins insert device catalog models"
on public.device_catalog_models for insert
to authenticated
with check (public.is_platform_admin());

create policy "Platform admins update device catalog models"
on public.device_catalog_models for update
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

create policy "Platform admins delete device catalog models"
on public.device_catalog_models for delete
to authenticated
using (public.is_platform_admin());

drop function public.save_user_switch_model(uuid, text, text);

create function public.save_user_device_model(
  catalog_device_type text,
  brand_id uuid,
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

  if char_length(normalized_manufacturer) not between 1 and 120 then
    raise exception 'Manufacturer must be between 1 and 120 characters';
  end if;

  if char_length(normalized_model) not between 1 and 160 then
    raise exception 'Model must be between 1 and 160 characters';
  end if;

  if catalog_device_type = 'switch' and brand_id is not null and not exists (
    select 1 from public.switch_brands where id = brand_id and is_active
  ) then
    raise exception 'The selected manufacturer is unavailable';
  end if;

  insert into public.user_device_models (
    user_id,
    device_type,
    switch_brand_id,
    manufacturer_name,
    model_name
  )
  values (
    auth.uid(),
    catalog_device_type,
    case when catalog_device_type = 'switch' then brand_id else null end,
    normalized_manufacturer,
    normalized_model
  )
  on conflict (user_id, device_type, lower(manufacturer_name), lower(model_name))
  do update set
    device_type = excluded.device_type,
    switch_brand_id = excluded.switch_brand_id,
    use_count = public.user_device_models.use_count + 1,
    last_used_at = now()
  returning * into saved_model;

  if catalog_device_type = 'switch'
    and brand_id is not null
    and not exists (
      select 1
      from public.switch_models catalog_model
      where catalog_model.switch_brand_id = brand_id
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
      brand_id,
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

create function public.search_device_catalog_models(
  catalog_device_type text,
  manufacturer text,
  search_term text default '',
  result_limit integer default 20
)
returns table (
  id uuid,
  device_type text,
  manufacturer_name text,
  model_name text,
  product_family text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    catalog.id,
    catalog.device_type,
    catalog.manufacturer_name,
    catalog.model_name,
    catalog.product_family
  from public.device_catalog_models catalog
  where catalog.device_type = catalog_device_type
    and catalog.is_active
    and lower(catalog.manufacturer_name) = lower(trim(manufacturer))
    and (
      nullif(trim(search_term), '') is null
      or catalog.model_name ilike '%' || trim(search_term) || '%'
      or catalog.product_family ilike '%' || trim(search_term) || '%'
    )
  order by
    case
      when lower(catalog.model_name) = lower(trim(search_term)) then 0
      when lower(catalog.model_name) like lower(trim(search_term)) || '%' then 1
      else 2
    end,
    catalog.model_name
  limit least(greatest(result_limit, 1), 50);
$$;

create function public.review_user_device_model(
  saved_model_id uuid,
  new_status public.switch_model_submission_status,
  admin_notes text default null
)
returns public.user_device_models
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_model public.user_device_models%rowtype;
  promoted_id uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'Only platform administrators can review user-added models';
  end if;

  if new_status not in ('approved', 'rejected') then
    raise exception 'Review status must be approved or rejected';
  end if;

  select * into saved_model
  from public.user_device_models
  where id = saved_model_id
  for update;

  if not found then
    raise exception 'User-added model not found';
  end if;

  if saved_model.device_type = 'switch' then
    raise exception 'Review switch models through the switch model submission queue';
  end if;

  if new_status = 'approved' then
    insert into public.device_catalog_models (
      device_type,
      manufacturer_name,
      model_name
    )
    values (
      saved_model.device_type,
      saved_model.manufacturer_name,
      saved_model.model_name
    )
    on conflict (device_type, lower(manufacturer_name), lower(model_name))
    do update set is_active = true
    returning id into promoted_id;
  end if;

  update public.user_device_models
    set review_status = new_status,
      review_notes = nullif(trim(admin_notes), ''),
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      catalog_model_id = promoted_id
  where id = saved_model_id
  returning * into saved_model;

  return saved_model;
end;
$$;

create or replace function public.link_promoted_user_switch_model()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  resolved_model_id uuid;
begin
  if new.status = 'duplicate' then
    resolved_model_id := new.duplicate_of;
  elsif new.status = 'approved' then
    select model.id into resolved_model_id
    from public.switch_models model
    where model.switch_brand_id = new.switch_brand_id
      and lower(coalesce(model.sku, model.name)) = lower(trim(new.model_name))
    limit 1;
  end if;

  if resolved_model_id is not null then
    update public.user_device_models
    set promoted_model_id = resolved_model_id,
        review_status = new.status
    where user_id = new.submitted_by
      and switch_brand_id = new.switch_brand_id
      and lower(model_name) = lower(trim(new.model_name));
  end if;

  return new;
end;
$$;

revoke all on function public.save_user_device_model(text, uuid, text, text) from public;
grant execute on function public.save_user_device_model(text, uuid, text, text) to authenticated;
revoke all on function public.search_device_catalog_models(text, text, text, integer) from public;
grant execute on function public.search_device_catalog_models(text, text, text, integer) to anon, authenticated;
revoke all on function public.review_user_device_model(uuid, public.switch_model_submission_status, text) from public;
grant execute on function public.review_user_device_model(uuid, public.switch_model_submission_status, text) to authenticated;