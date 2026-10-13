-- Audit tasks target a rack instead of a device.
alter table public.tasks add column if not exists rack_id uuid references public.racks(id) on delete cascade;
alter table public.tasks alter column device_id drop not null;
create index if not exists tasks_rack_id_idx on public.tasks (rack_id);
