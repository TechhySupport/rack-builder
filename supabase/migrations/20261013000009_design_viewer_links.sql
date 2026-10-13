-- Public read-only viewer links: /viewer/<token> shows one design to anyone who has the link.
-- A link can be turned off (row deleted) or regenerated (new row) by whoever manages the design.

create table public.design_links (
  design_id  uuid primary key references public.designs (id) on delete cascade,
  token      text not null unique default replace(gen_random_uuid()::text, '-', ''),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

alter table public.design_links enable row level security;

create policy "design links: managers read" on public.design_links for select
  using (public.design_manages(design_id));
create policy "design links: managers create" on public.design_links for insert
  with check (public.design_manages(design_id));
create policy "design links: managers delete" on public.design_links for delete
  using (public.design_manages(design_id));

-- Anonymous visitors cannot read tables; this exposes only the name and drawing for a valid token.
create or replace function public.get_design_by_token(p_token text)
returns table (name text, data jsonb, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select d.name, d.data, d.updated_at
  from public.design_links l
  join public.designs d on d.id = l.design_id
  where l.token = p_token;
$$;

revoke all on function public.get_design_by_token(text) from public;
grant execute on function public.get_design_by_token(text) to anon, authenticated;
