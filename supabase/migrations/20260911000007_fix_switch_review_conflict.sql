create or replace function public.save_user_device_model(
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
#variable_conflict use_variable
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
    on conflict do nothing;
  end if;

  return saved_model;
end;
$$;