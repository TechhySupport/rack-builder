create table public.user_switch_models (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  switch_brand_id uuid references public.switch_brands(id) on delete set null,
  manufacturer_name text not null check (char_length(trim(manufacturer_name)) between 1 and 120),
  model_name text not null check (char_length(trim(model_name)) between 1 and 160),
  promoted_model_id uuid references public.switch_models(id) on delete set null,
  use_count integer not null default 1 check (use_count >= 1),
  last_used_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index user_switch_models_owner_name_key
  on public.user_switch_models (user_id, lower(manufacturer_name), lower(model_name));
create index user_switch_models_owner_recent_idx
  on public.user_switch_models (user_id, last_used_at desc);
create index user_switch_models_review_idx
  on public.user_switch_models (switch_brand_id, lower(model_name));

create trigger set_user_switch_models_updated_at
before update on public.user_switch_models
for each row execute function public.set_switch_brand_updated_at();

alter table public.user_switch_models enable row level security;

create policy "Users read their saved switch models"
on public.user_switch_models for select
to authenticated
using (user_id = auth.uid() or public.is_platform_admin());

create policy "Users delete their saved switch models"
on public.user_switch_models for delete
to authenticated
using (user_id = auth.uid() or public.is_platform_admin());

create or replace function public.save_user_switch_model(
  brand_id uuid,
  manufacturer text,
  model text
)
returns public.user_switch_models
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_model public.user_switch_models%rowtype;
  normalized_manufacturer text := regexp_replace(trim(manufacturer), '\s+', ' ', 'g');
  normalized_model text := regexp_replace(trim(model), '\s+', ' ', 'g');
begin
  if auth.uid() is null then
    raise exception 'Sign in to save a custom switch model';
  end if;

  if char_length(normalized_manufacturer) not between 1 and 120 then
    raise exception 'Manufacturer must be between 1 and 120 characters';
  end if;

  if char_length(normalized_model) not between 1 and 160 then
    raise exception 'Model must be between 1 and 160 characters';
  end if;

  if brand_id is not null and not exists (
    select 1 from public.switch_brands where id = brand_id and is_active
  ) then
    raise exception 'The selected manufacturer is unavailable';
  end if;

  insert into public.user_switch_models (
    user_id,
    switch_brand_id,
    manufacturer_name,
    model_name
  )
  values (
    auth.uid(),
    brand_id,
    normalized_manufacturer,
    normalized_model
  )
  on conflict (user_id, lower(manufacturer_name), lower(model_name))
  do update set
    switch_brand_id = coalesce(excluded.switch_brand_id, public.user_switch_models.switch_brand_id),
    use_count = public.user_switch_models.use_count + 1,
    last_used_at = now()
  returning * into saved_model;

  if brand_id is not null
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
    update public.user_switch_models
    set promoted_model_id = resolved_model_id
    where user_id = new.submitted_by
      and switch_brand_id = new.switch_brand_id
      and lower(model_name) = lower(trim(new.model_name));
  end if;

  return new;
end;
$$;

create trigger link_promoted_user_switch_model
after update of status on public.switch_model_submissions
for each row
when (new.status in ('approved', 'duplicate'))
execute function public.link_promoted_user_switch_model();

revoke all on function public.save_user_switch_model(uuid, text, text) from public;
grant execute on function public.save_user_switch_model(uuid, text, text) to authenticated;