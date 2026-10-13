-- Members assigned to a site (member_site_permissions) automatically get that site's heat maps:
-- viewers can open them, editors can also change them.

create or replace function public.heatmap_site_access(p_heatmap uuid)
returns text language sql stable security definer set search_path = public as $$
  select case public.my_org_role(h.organisation_id) when 'editor' then 'edit' else 'view' end
  from public.heatmaps h
  where h.id = p_heatmap
    and h.site_id is not null
    and public.my_org_role(h.organisation_id) in ('editor', 'viewer')
    and exists (
      select 1 from public.member_site_permissions msp
      where msp.user_id = auth.uid() and msp.site_id = h.site_id
    );
$$;

create or replace function public.heatmap_can_view(p_heatmap uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.heatmap_manages(p_heatmap)
    or public.heatmap_site_access(p_heatmap) is not null
    or exists (
      select 1 from public.heatmap_shares s
      join public.heatmaps h on h.id = s.heatmap_id
      where s.heatmap_id = p_heatmap and s.user_id = auth.uid()
        and public.my_org_role(h.organisation_id) is not null
    );
$$;

create or replace function public.heatmap_can_edit(p_heatmap uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.heatmaps h
    where h.id = p_heatmap and public.heatmap_manages(p_heatmap)
      and public.my_org_role(h.organisation_id) in ('owner', 'admin', 'editor')
  ) or public.heatmap_site_access(p_heatmap) = 'edit' or exists (
    select 1 from public.heatmap_shares s
    join public.heatmaps h on h.id = s.heatmap_id
    where s.heatmap_id = p_heatmap and s.user_id = auth.uid() and s.permission = 'edit'
      and public.my_org_role(h.organisation_id) is not null
  );
$$;
