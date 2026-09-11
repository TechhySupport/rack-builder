create extension if not exists pg_trgm with schema extensions;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role' = 'admin', false)
    or coalesce(auth.jwt() -> 'app_metadata' ->> 'is_admin' = 'true', false);
$$;

create table public.switch_brands (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 120),
  slug text not null unique check (slug = lower(slug) and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index switch_brands_name_lower_key on public.switch_brands (lower(name));
create index switch_brands_active_name_idx on public.switch_brands (is_active, lower(name));
create index switch_brands_name_trgm_idx on public.switch_brands using gin (lower(name) extensions.gin_trgm_ops);

create type public.switch_brand_submission_status as enum ('pending', 'approved', 'rejected', 'duplicate');

create table public.switch_brand_submissions (
  id uuid primary key default gen_random_uuid(),
  manufacturer_name text not null check (char_length(trim(manufacturer_name)) between 2 and 120),
  website text check (website is null or char_length(website) <= 500),
  notes text check (notes is null or char_length(notes) <= 2000),
  submitted_by uuid references auth.users(id) on delete set null,
  status public.switch_brand_submission_status not null default 'pending',
  admin_notes text check (admin_notes is null or char_length(admin_notes) <= 2000),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  duplicate_of uuid references public.switch_brands(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint switch_brand_submission_review_check check (
    (status = 'pending' and reviewed_by is null and reviewed_at is null)
    or (status <> 'pending' and reviewed_by is not null and reviewed_at is not null)
  ),
  constraint switch_brand_submission_duplicate_check check (
    (status = 'duplicate' and duplicate_of is not null)
    or (status <> 'duplicate')
  )
);

create unique index switch_brand_submissions_pending_name_key
  on public.switch_brand_submissions (lower(manufacturer_name))
  where status = 'pending';
create index switch_brand_submissions_status_created_idx
  on public.switch_brand_submissions (status, created_at desc);
create index switch_brand_submissions_submitter_idx
  on public.switch_brand_submissions (submitted_by, created_at desc);

alter table public.devices
  add column switch_brand_id uuid references public.switch_brands(id) on delete set null,
  add column custom_manufacturer text check (custom_manufacturer is null or char_length(trim(custom_manufacturer)) between 1 and 120);

create index devices_switch_brand_id_idx on public.devices (switch_brand_id);

create or replace function public.set_switch_brand_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_switch_brands_updated_at
before update on public.switch_brands
for each row execute function public.set_switch_brand_updated_at();

create trigger set_switch_brand_submissions_updated_at
before update on public.switch_brand_submissions
for each row execute function public.set_switch_brand_updated_at();

alter table public.switch_brands enable row level security;
alter table public.switch_brand_submissions enable row level security;

create policy "Active switch brands are readable"
on public.switch_brands for select
to anon, authenticated
using (is_active or public.is_platform_admin());

create policy "Platform admins insert switch brands"
on public.switch_brands for insert
to authenticated
with check (public.is_platform_admin());

create policy "Platform admins update switch brands"
on public.switch_brands for update
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

create policy "Platform admins delete switch brands"
on public.switch_brands for delete
to authenticated
using (public.is_platform_admin());

create policy "Authenticated users submit switch brands"
on public.switch_brand_submissions for insert
to authenticated
with check (
  submitted_by = auth.uid()
  and status = 'pending'
  and admin_notes is null
  and reviewed_by is null
  and reviewed_at is null
  and duplicate_of is null
);

create policy "Platform admins read switch brand submissions"
on public.switch_brand_submissions for select
to authenticated
using (public.is_platform_admin());

create policy "Platform admins update switch brand submissions"
on public.switch_brand_submissions for update
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

create policy "Platform admins delete switch brand submissions"
on public.switch_brand_submissions for delete
to authenticated
using (public.is_platform_admin());

create or replace function public.search_switch_brands(search_term text default '', result_limit integer default 20)
returns table (id uuid, name text, slug text)
language sql
stable
security invoker
set search_path = ''
as $$
  select brand.id, brand.name, brand.slug
  from public.switch_brands brand
  where brand.is_active
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

create or replace function public.review_switch_brand_submission(
  submission_id uuid,
  review_status public.switch_brand_submission_status,
  review_notes text default null,
  existing_brand_id uuid default null
)
returns public.switch_brand_submissions
language plpgsql
security definer
set search_path = ''
as $$
declare
  submission public.switch_brand_submissions%rowtype;
  reviewed_submission public.switch_brand_submissions%rowtype;
  resolved_brand_id uuid;
  generated_slug text;
begin
  if not public.is_platform_admin() then
    raise exception 'Only platform administrators can review manufacturer submissions';
  end if;

  if review_status not in ('approved', 'rejected', 'duplicate') then
    raise exception 'Review status must be approved, rejected, or duplicate';
  end if;

  select * into submission
  from public.switch_brand_submissions
  where id = submission_id
  for update;

  if not found then
    raise exception 'Manufacturer submission not found';
  end if;

  if review_status = 'approved' then
    generated_slug := trim(both '-' from regexp_replace(lower(trim(submission.manufacturer_name)), '[^a-z0-9]+', '-', 'g'));

    insert into public.switch_brands (name, slug)
    values (trim(submission.manufacturer_name), generated_slug)
    on conflict do nothing
    returning id into resolved_brand_id;

    if resolved_brand_id is null then
      select brand.id into resolved_brand_id
      from public.switch_brands brand
      where lower(brand.name) = lower(trim(submission.manufacturer_name))
         or brand.slug = generated_slug
      limit 1;
    end if;
  elsif review_status = 'duplicate' then
    if existing_brand_id is null then
      raise exception 'An existing manufacturer is required for duplicate submissions';
    end if;
    resolved_brand_id := existing_brand_id;
  end if;

  update public.switch_brand_submissions
  set status = review_status,
      admin_notes = nullif(trim(review_notes), ''),
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      duplicate_of = case when review_status = 'duplicate' then resolved_brand_id else null end
  where id = submission_id
  returning * into reviewed_submission;

  return reviewed_submission;
end;
$$;

revoke all on function public.search_switch_brands(text, integer) from public;
grant execute on function public.search_switch_brands(text, integer) to anon, authenticated;
revoke all on function public.review_switch_brand_submission(uuid, public.switch_brand_submission_status, text, uuid) from public;
grant execute on function public.review_switch_brand_submission(uuid, public.switch_brand_submission_status, text, uuid) to authenticated;

insert into public.switch_brands (name, slug) values
  ('Accton Technology', 'accton-technology'),
  ('Adtran', 'adtran'),
  ('Alcatel-Lucent Enterprise', 'alcatel-lucent-enterprise'),
  ('Allied Telesis', 'allied-telesis'),
  ('Alta Labs', 'alta-labs'),
  ('Arista', 'arista'),
  ('Aruba', 'aruba'),
  ('Avaya', 'avaya'),
  ('Belkin', 'belkin'),
  ('Black Box', 'black-box'),
  ('Brocade', 'brocade'),
  ('Calix', 'calix'),
  ('Cambium Networks', 'cambium-networks'),
  ('Ciena', 'ciena'),
  ('Cisco', 'cisco'),
  ('Comware', 'comware'),
  ('D-Link', 'd-link'),
  ('Dell', 'dell'),
  ('Edgecore Networks', 'edgecore-networks'),
  ('EnGenius', 'engenius'),
  ('Extreme Networks', 'extreme-networks'),
  ('Fortinet', 'fortinet'),
  ('FS.com', 'fs-com'),
  ('Fujitsu', 'fujitsu'),
  ('Grandstream', 'grandstream'),
  ('H3C', 'h3c'),
  ('Hirschmann', 'hirschmann'),
  ('HPE', 'hpe'),
  ('Huawei', 'huawei'),
  ('IBM', 'ibm'),
  ('Juniper', 'juniper'),
  ('Lancom Systems', 'lancom-systems'),
  ('Lantronix', 'lantronix'),
  ('Lenovo', 'lenovo'),
  ('Linksys', 'linksys'),
  ('MikroTik', 'mikrotik'),
  ('Moxa', 'moxa'),
  ('NETGEAR', 'netgear'),
  ('Nokia', 'nokia'),
  ('NVIDIA', 'nvidia'),
  ('Omnitron Systems', 'omnitron-systems'),
  ('Other / Custom', 'other-custom'),
  ('Peplink', 'peplink'),
  ('Perle Systems', 'perle-systems'),
  ('Phoenix Contact', 'phoenix-contact'),
  ('PLANET Technology', 'planet-technology'),
  ('QNAP', 'qnap'),
  ('Ruckus Networks', 'ruckus-networks'),
  ('Ruijie Networks', 'ruijie-networks'),
  ('Siemens', 'siemens'),
  ('Sophos', 'sophos'),
  ('Synology', 'synology'),
  ('Teltonika Networks', 'teltonika-networks'),
  ('TP-Link', 'tp-link'),
  ('Transition Networks', 'transition-networks'),
  ('TRENDnet', 'trendnet'),
  ('Ubiquiti', 'ubiquiti'),
  ('Westermo', 'westermo'),
  ('Yamaha', 'yamaha'),
  ('ZTE', 'zte')
on conflict (slug) do update
set name = excluded.name,
    is_active = true;
