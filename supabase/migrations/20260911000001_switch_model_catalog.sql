create table public.switch_models (
  id uuid primary key default gen_random_uuid(),
  switch_brand_id uuid not null references public.switch_brands(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 160),
  slug text not null check (slug = lower(slug) and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  product_family text check (product_family is null or char_length(trim(product_family)) between 1 and 120),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (switch_brand_id, slug)
);

create unique index switch_models_brand_name_lower_key
  on public.switch_models (switch_brand_id, lower(name));
create index switch_models_brand_active_name_idx
  on public.switch_models (switch_brand_id, is_active, lower(name));
create index switch_models_name_trgm_idx
  on public.switch_models using gin (lower(name) extensions.gin_trgm_ops);

create type public.switch_model_submission_status as enum ('pending', 'approved', 'rejected', 'duplicate');

create table public.switch_model_submissions (
  id uuid primary key default gen_random_uuid(),
  switch_brand_id uuid not null references public.switch_brands(id) on delete cascade,
  model_name text not null check (char_length(trim(model_name)) between 1 and 160),
  product_family text check (product_family is null or char_length(trim(product_family)) between 1 and 120),
  notes text check (notes is null or char_length(notes) <= 2000),
  submitted_by uuid references auth.users(id) on delete set null,
  status public.switch_model_submission_status not null default 'pending',
  admin_notes text check (admin_notes is null or char_length(admin_notes) <= 2000),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  duplicate_of uuid references public.switch_models(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint switch_model_submission_review_check check (
    (status = 'pending' and reviewed_by is null and reviewed_at is null)
    or (status <> 'pending' and reviewed_by is not null and reviewed_at is not null)
  ),
  constraint switch_model_submission_duplicate_check check (
    (status = 'duplicate' and duplicate_of is not null)
    or (status <> 'duplicate')
  )
);

create unique index switch_model_submissions_pending_name_key
  on public.switch_model_submissions (switch_brand_id, lower(model_name))
  where status = 'pending';
create index switch_model_submissions_status_created_idx
  on public.switch_model_submissions (status, created_at desc);
create index switch_model_submissions_submitter_idx
  on public.switch_model_submissions (submitted_by, created_at desc);

alter table public.devices
  add column switch_model_id uuid references public.switch_models(id) on delete set null,
  add column custom_model text check (custom_model is null or char_length(trim(custom_model)) between 1 and 160);

create index devices_switch_model_id_idx on public.devices (switch_model_id);

create trigger set_switch_models_updated_at
before update on public.switch_models
for each row execute function public.set_switch_brand_updated_at();

create trigger set_switch_model_submissions_updated_at
before update on public.switch_model_submissions
for each row execute function public.set_switch_brand_updated_at();

alter table public.switch_models enable row level security;
alter table public.switch_model_submissions enable row level security;

create policy "Active switch models are readable"
on public.switch_models for select
to anon, authenticated
using (is_active or public.is_platform_admin());

create policy "Platform admins insert switch models"
on public.switch_models for insert
to authenticated
with check (public.is_platform_admin());

create policy "Platform admins update switch models"
on public.switch_models for update
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

create policy "Platform admins delete switch models"
on public.switch_models for delete
to authenticated
using (public.is_platform_admin());

create policy "Authenticated users submit switch models"
on public.switch_model_submissions for insert
to authenticated
with check (
  submitted_by = auth.uid()
  and status = 'pending'
  and admin_notes is null
  and reviewed_by is null
  and reviewed_at is null
  and duplicate_of is null
);

create policy "Platform admins read switch model submissions"
on public.switch_model_submissions for select
to authenticated
using (public.is_platform_admin());

create policy "Platform admins update switch model submissions"
on public.switch_model_submissions for update
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

create policy "Platform admins delete switch model submissions"
on public.switch_model_submissions for delete
to authenticated
using (public.is_platform_admin());

create or replace function public.search_switch_models(
  brand_id uuid,
  search_term text default '',
  result_limit integer default 20
)
returns table (id uuid, switch_brand_id uuid, name text, slug text, product_family text)
language sql
stable
security invoker
set search_path = ''
as $$
  select model.id, model.switch_brand_id, model.name, model.slug, model.product_family
  from public.switch_models model
  where model.switch_brand_id = brand_id
    and model.is_active
    and (
      nullif(trim(search_term), '') is null
      or model.name ilike '%' || trim(search_term) || '%'
      or model.product_family ilike '%' || trim(search_term) || '%'
    )
  order by
    case
      when lower(model.name) = lower(trim(search_term)) then 0
      when lower(model.name) like lower(trim(search_term)) || '%' then 1
      when lower(coalesce(model.product_family, '')) like lower(trim(search_term)) || '%' then 2
      else 3
    end,
    model.name
  limit least(greatest(result_limit, 1), 50);
$$;

create or replace function public.review_switch_model_submission(
  submission_id uuid,
  review_status public.switch_model_submission_status,
  review_notes text default null,
  existing_model_id uuid default null
)
returns public.switch_model_submissions
language plpgsql
security definer
set search_path = ''
as $$
declare
  submission public.switch_model_submissions%rowtype;
  reviewed_submission public.switch_model_submissions%rowtype;
  resolved_model_id uuid;
  generated_slug text;
begin
  if not public.is_platform_admin() then
    raise exception 'Only platform administrators can review switch model submissions';
  end if;

  if review_status not in ('approved', 'rejected', 'duplicate') then
    raise exception 'Review status must be approved, rejected, or duplicate';
  end if;

  select * into submission
  from public.switch_model_submissions
  where id = submission_id
  for update;

  if not found then
    raise exception 'Switch model submission not found';
  end if;

  if review_status = 'approved' then
    generated_slug := trim(both '-' from regexp_replace(lower(trim(submission.model_name)), '[^a-z0-9]+', '-', 'g'));

    insert into public.switch_models (switch_brand_id, name, slug, product_family)
    values (submission.switch_brand_id, trim(submission.model_name), generated_slug, nullif(trim(submission.product_family), ''))
    on conflict do nothing
    returning id into resolved_model_id;

    if resolved_model_id is null then
      select model.id into resolved_model_id
      from public.switch_models model
      where model.switch_brand_id = submission.switch_brand_id
        and (
          lower(model.name) = lower(trim(submission.model_name))
          or model.slug = generated_slug
        )
      limit 1;
    end if;
  elsif review_status = 'duplicate' then
    select model.id into resolved_model_id
    from public.switch_models model
    where model.id = existing_model_id
      and model.switch_brand_id = submission.switch_brand_id;

    if resolved_model_id is null then
      raise exception 'An existing model from the same manufacturer is required for duplicate submissions';
    end if;
  end if;

  update public.switch_model_submissions
  set status = review_status,
      admin_notes = nullif(trim(review_notes), ''),
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      duplicate_of = case when review_status = 'duplicate' then resolved_model_id else null end
  where id = submission_id
  returning * into reviewed_submission;

  return reviewed_submission;
end;
$$;

revoke all on function public.search_switch_models(uuid, text, integer) from public;
grant execute on function public.search_switch_models(uuid, text, integer) to anon, authenticated;
revoke all on function public.review_switch_model_submission(uuid, public.switch_model_submission_status, text, uuid) from public;
grant execute on function public.review_switch_model_submission(uuid, public.switch_model_submission_status, text, uuid) to authenticated;

with seed_models(brand_slug, model_name, model_slug, product_family) as (
  values
    ('arista', '7050X3', '7050x3', '7050 Series'),
    ('arista', '7060X5', '7060x5', '7060 Series'),
    ('aruba', 'CX 6100', 'cx-6100', 'CX 6000 Series'),
    ('aruba', 'CX 6200', 'cx-6200', 'CX 6000 Series'),
    ('aruba', 'CX 6300', 'cx-6300', 'CX 6000 Series'),
    ('cisco', 'Catalyst 2960', 'catalyst-2960', 'Catalyst 2900 Series'),
    ('cisco', 'Catalyst 9200', 'catalyst-9200', 'Catalyst 9000 Series'),
    ('cisco', 'Catalyst 9300', 'catalyst-9300', 'Catalyst 9000 Series'),
    ('cisco', 'Catalyst 9400', 'catalyst-9400', 'Catalyst 9000 Series'),
    ('cisco', 'Catalyst 9500', 'catalyst-9500', 'Catalyst 9000 Series'),
    ('dell', 'PowerSwitch N3200-ON', 'powerswitch-n3200-on', 'PowerSwitch N Series'),
    ('dell', 'PowerSwitch S5200-ON', 'powerswitch-s5200-on', 'PowerSwitch S Series'),
    ('extreme-networks', 'SwitchEngine 5420', 'switchengine-5420', 'Universal Switch Platform'),
    ('extreme-networks', 'SwitchEngine 5520', 'switchengine-5520', 'Universal Switch Platform'),
    ('fortinet', 'FortiSwitch 124F', 'fortiswitch-124f', 'FortiSwitch Secure Access'),
    ('fortinet', 'FortiSwitch 248E-FPOE', 'fortiswitch-248e-fpoe', 'FortiSwitch Secure Access'),
    ('hpe', 'FlexNetwork 5130 EI', 'flexnetwork-5130-ei', 'FlexNetwork 5130'),
    ('hpe', 'FlexFabric 5940', 'flexfabric-5940', 'FlexFabric 5900 Series'),
    ('juniper', 'EX2300', 'ex2300', 'EX Series'),
    ('juniper', 'EX3400', 'ex3400', 'EX Series'),
    ('juniper', 'EX4100', 'ex4100', 'EX Series'),
    ('juniper', 'EX4400', 'ex4400', 'EX Series'),
    ('mikrotik', 'CRS326-24G-2S+RM', 'crs326-24g-2s-rm', 'Cloud Router Switch'),
    ('mikrotik', 'CRS354-48G-4S+2Q+RM', 'crs354-48g-4s-2q-rm', 'Cloud Router Switch'),
    ('netgear', 'M4300-28G', 'm4300-28g', 'M4300 Series'),
    ('netgear', 'M4350-24G4XF', 'm4350-24g4xf', 'M4350 Series'),
    ('nvidia', 'Spectrum SN2010', 'spectrum-sn2010', 'Spectrum'),
    ('nvidia', 'Spectrum SN3700', 'spectrum-sn3700', 'Spectrum'),
    ('ruckus-networks', 'ICX 7150', 'icx-7150', 'ICX Series'),
    ('ruckus-networks', 'ICX 7550', 'icx-7550', 'ICX Series'),
    ('tp-link', 'Omada SG3428X', 'omada-sg3428x', 'Omada'),
    ('tp-link', 'Omada SG6654X', 'omada-sg6654x', 'Omada'),
    ('ubiquiti', 'UniFi Switch 24', 'unifi-switch-24', 'UniFi Switch'),
    ('ubiquiti', 'UniFi Switch 48', 'unifi-switch-48', 'UniFi Switch'),
    ('ubiquiti', 'UniFi Switch Pro Max 24 PoE', 'unifi-switch-pro-max-24-poe', 'UniFi Switch Pro Max'),
    ('ubiquiti', 'UniFi Switch Pro Max 48 PoE', 'unifi-switch-pro-max-48-poe', 'UniFi Switch Pro Max')
)
insert into public.switch_models (switch_brand_id, name, slug, product_family)
select brand.id, seed.model_name, seed.model_slug, seed.product_family
from seed_models seed
join public.switch_brands brand on brand.slug = seed.brand_slug
on conflict (switch_brand_id, slug) do update
set name = excluded.name,
    product_family = excluded.product_family,
    is_active = true;