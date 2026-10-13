-- Racks added without a known RU size: ru_capacity holds a placeholder until an auditor confirms it.
alter table public.racks add column if not exists ru_size_unknown boolean not null default false;
