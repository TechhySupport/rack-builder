alter table public.device_connection_points
  add column face public.rack_face not null default 'front';

update public.device_connection_points
set face = 'rear'
where medium = 'power';