-- Wi-Fi devices placed on a heat map are mirrored into public.devices so they can be searched with the
-- rest of the inventory and shown on their floor plan. A trigger keeps them in step with the heat map.

alter table public.devices alter column rack_id drop not null;
alter table public.devices alter column starting_ru drop not null;

alter table public.devices
  add column site_id          uuid references public.sites (id) on delete cascade,
  add column heatmap_id       uuid references public.heatmaps (id) on delete cascade,
  add column heatmap_device_id text,
  add column map_label        text,
  add column map_x            numeric,
  add column map_y            numeric;

alter table public.devices
  add constraint devices_location_check check (rack_id is not null or heatmap_id is not null);
create unique index devices_heatmap_device_key on public.devices (heatmap_id, heatmap_device_id) where heatmap_id is not null;
create index devices_site_id_idx on public.devices (site_id) where site_id is not null;

create or replace function public.sync_heatmap_devices(p_heatmap uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  h public.heatmaps;
begin
  select * into h from public.heatmaps where id = p_heatmap;
  if not found then return; end if;

  delete from public.devices d
  where d.heatmap_id = h.id
    and not exists (
      select 1 from jsonb_array_elements(coalesce(h.data -> 'devices', '[]'::jsonb)) e
      where e ->> 'id' = d.heatmap_device_id
    );

  insert into public.devices (organisation_id, site_id, heatmap_id, heatmap_device_id, map_label, map_x, map_y, name, device_type, created_by)
  select h.organisation_id, h.site_id, h.id, e ->> 'id', h.name,
         (e ->> 'x')::numeric, (e ->> 'y')::numeric,
         left(coalesce(nullif(btrim(e ->> 'name'), ''), 'Access point'), 300),
         'access_point', h.created_by
  from jsonb_array_elements(coalesce(h.data -> 'devices', '[]'::jsonb)) e
  where e ->> 'id' is not null
  on conflict (heatmap_id, heatmap_device_id) where heatmap_id is not null do update
    set name = excluded.name, site_id = excluded.site_id, organisation_id = excluded.organisation_id,
        map_label = excluded.map_label, map_x = excluded.map_x, map_y = excluded.map_y;
end;
$$;

revoke all on function public.sync_heatmap_devices(uuid) from public;

create or replace function public.trg_sync_heatmap_devices()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.sync_heatmap_devices(new.id);
  return null;
end;
$$;

create trigger trg_heatmaps_sync_devices
  after insert or update of data, name, site_id on public.heatmaps
  for each row execute function public.trg_sync_heatmap_devices();

do $$
declare r record;
begin
  for r in select id from public.heatmaps loop
    perform public.sync_heatmap_devices(r.id);
  end loop;
end $$;
