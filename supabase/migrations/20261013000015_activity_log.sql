-- Activity log behind the header notification bell.

create table public.activity_log (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  actor_id        uuid references auth.users(id) on delete set null,
  actor_name      text not null default 'Someone',
  action          text not null,
  entity_type     text not null check (entity_type in ('site', 'rack', 'design', 'heatmap', 'task', 'member')),
  entity_id       uuid,
  entity_name     text,
  site_id         uuid,
  target_user_id  uuid references auth.users(id) on delete cascade,
  detail          text,
  event_count     integer not null default 1,
  created_at      timestamptz not null default now()
);
create index on public.activity_log (organisation_id, created_at desc);
create index on public.activity_log (target_user_id, created_at desc);

alter table public.activity_log enable row level security;

-- Rows are written only by the triggers below; visibility follows access to the thing that changed.
create policy "activity_log: visible to members"
  on public.activity_log for select
  using (
    public.my_org_role(organisation_id) is not null
    and (target_user_id is null or target_user_id = auth.uid())
    and case entity_type
      when 'design' then public.design_can_view(entity_id)
        or (action = 'deleted' and public.my_org_role(organisation_id) in ('owner', 'admin'))
      when 'heatmap' then public.heatmap_can_view(entity_id)
        or (action = 'deleted' and public.my_org_role(organisation_id) in ('owner', 'admin'))
      when 'task' then true
      when 'member' then true
      else (entity_type = 'site' and action = 'deleted')
        or exists (select 1 from public.sites s where s.id = activity_log.site_id)
    end
  );

create table public.notification_state (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  last_seen_at timestamptz not null default now()
);
alter table public.notification_state enable row level security;
create policy "notification_state: own read" on public.notification_state for select using (user_id = auth.uid());
create policy "notification_state: own insert" on public.notification_state for insert with check (user_id = auth.uid());
create policy "notification_state: own update" on public.notification_state for update using (user_id = auth.uid()) with check (user_id = auth.uid());

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.activity_log;
  end if;
end $$;

-- p_coalesce folds repeated changes by one person into a single entry for 10 minutes (autosave, bulk edits).
create or replace function public.log_activity(
  p_org uuid, p_action text, p_type text, p_id uuid, p_name text,
  p_site uuid default null, p_target uuid default null, p_detail text default null, p_coalesce boolean default false
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  v_name text;
  v_existing uuid;
begin
  if v_actor is null then return; end if;
  if p_target is not null and p_target = v_actor then return; end if;
  if not exists (select 1 from public.organisations where id = p_org) then return; end if;

  select full_name into v_name from public.profiles where id = v_actor;

  if p_coalesce then
    select id into v_existing from public.activity_log
    where actor_id = v_actor and action = p_action and entity_type = p_type
      and entity_id is not distinct from p_id
      and target_user_id is not distinct from p_target
      and created_at > now() - interval '10 minutes'
    order by created_at desc limit 1;
    if v_existing is not null then
      update public.activity_log
      set created_at = now(), event_count = event_count + 1, entity_name = p_name, detail = coalesce(p_detail, detail)
      where id = v_existing;
      return;
    end if;
  end if;

  insert into public.activity_log (organisation_id, actor_id, actor_name, action, entity_type, entity_id, entity_name, site_id, target_user_id, detail)
  values (p_org, v_actor, coalesce(v_name, 'Someone'), p_action, p_type, p_id, p_name, p_site, p_target, p_detail);
end $$;
revoke all on function public.log_activity(uuid, text, text, uuid, text, uuid, uuid, text, boolean) from public, anon, authenticated;

-- sites
create or replace function public.trg_log_sites() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_activity(new.organisation_id, 'created', 'site', new.id, new.name, new.id);
  elsif tg_op = 'UPDATE' then
    if new.name is distinct from old.name or new.address is distinct from old.address then
      perform public.log_activity(new.organisation_id, 'updated', 'site', new.id, new.name, new.id, null, null, true);
    end if;
  else
    perform public.log_activity(old.organisation_id, 'deleted', 'site', old.id, old.name, old.id);
  end if;
  return null;
end $$;
create trigger trg_log_sites after insert or update or delete on public.sites
  for each row execute function public.trg_log_sites();

-- racks
create or replace function public.trg_log_racks() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_activity(new.organisation_id, 'created', 'rack', new.id, new.name, new.site_id);
  elsif tg_op = 'UPDATE' then
    if new.name is distinct from old.name or new.site_id is distinct from old.site_id
       or new.location_id is distinct from old.location_id or new.ru_capacity is distinct from old.ru_capacity then
      perform public.log_activity(new.organisation_id, 'updated', 'rack', new.id, new.name, new.site_id, null, null, true);
    end if;
  else
    perform public.log_activity(old.organisation_id, 'deleted', 'rack', old.id, old.name, old.site_id);
  end if;
  return null;
end $$;
create trigger trg_log_racks after insert or update or delete on public.racks
  for each row execute function public.trg_log_racks();

-- devices in racks (heat map devices are covered by the heat map entry)
create or replace function public.trg_log_devices() returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_rack uuid;
  v_row public.devices;
  v_rack_name text;
  v_site uuid;
begin
  if tg_op = 'DELETE' then v_row := old; else v_row := new; end if;
  v_rack := v_row.rack_id;
  if v_rack is null then return null; end if;

  if tg_op = 'UPDATE' and not (
    new.name is distinct from old.name or new.rack_id is distinct from old.rack_id
    or new.starting_ru is distinct from old.starting_ru or new.ru_height is distinct from old.ru_height
    or new.device_type is distinct from old.device_type or new.model is distinct from old.model
    or new.hostname is distinct from old.hostname or new.ip_address is distinct from old.ip_address
    or new.mac_address is distinct from old.mac_address or new.serial_number is distinct from old.serial_number
    or new.asset_tag is distinct from old.asset_tag or new.status is distinct from old.status
  ) then
    return null;
  end if;

  select name, site_id into v_rack_name, v_site from public.racks where id = v_rack;
  if v_rack_name is null then return null; end if;

  perform public.log_activity(v_row.organisation_id, 'devices_changed', 'rack', v_rack, v_rack_name, v_site, null, v_row.name, true);
  return null;
end $$;
create trigger trg_log_devices after insert or update or delete on public.devices
  for each row execute function public.trg_log_devices();

-- tasks: the assignee hears about new tasks, the creator hears when one is completed
create or replace function public.trg_log_tasks() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.assignee_id is not null then
      perform public.log_activity(new.organisation_id, 'task_assigned', 'task', null, new.title, null, new.assignee_id, null, true);
    end if;
  else
    if new.assignee_id is distinct from old.assignee_id and new.assignee_id is not null then
      perform public.log_activity(new.organisation_id, 'task_assigned', 'task', null, new.title, null, new.assignee_id, null, true);
    end if;
    if old.status = 'open' and new.status is distinct from 'open' and new.created_by is not null then
      perform public.log_activity(new.organisation_id, 'task_completed', 'task', null, new.title, null, new.created_by, null, true);
    end if;
  end if;
  return null;
end $$;
create trigger trg_log_tasks after insert or update on public.tasks
  for each row execute function public.trg_log_tasks();

-- members joining
create or replace function public.trg_log_members() returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_name text;
begin
  if new.status = 'active' and (tg_op = 'INSERT' or old.status is distinct from 'active') then
    select full_name into v_name from public.profiles where id = new.user_id;
    perform public.log_activity(new.organisation_id, 'member_joined', 'member', new.user_id, coalesce(v_name, 'A new member'));
  end if;
  return null;
end $$;
create trigger trg_log_members after insert or update on public.organisation_members
  for each row execute function public.trg_log_members();

-- designs and heat maps
create or replace function public.trg_log_designs() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_activity(new.organisation_id, 'created', 'design', new.id, new.name);
  elsif tg_op = 'UPDATE' then
    perform public.log_activity(new.organisation_id, 'updated', 'design', new.id, new.name, null, null, null, true);
  else
    perform public.log_activity(old.organisation_id, 'deleted', 'design', old.id, old.name);
  end if;
  return null;
end $$;
create trigger trg_log_designs after insert or update or delete on public.designs
  for each row execute function public.trg_log_designs();

create or replace function public.trg_log_heatmaps() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_activity(new.organisation_id, 'created', 'heatmap', new.id, new.name, new.site_id);
  elsif tg_op = 'UPDATE' then
    perform public.log_activity(new.organisation_id, 'updated', 'heatmap', new.id, new.name, new.site_id, null, null, true);
  else
    perform public.log_activity(old.organisation_id, 'deleted', 'heatmap', old.id, old.name, old.site_id);
  end if;
  return null;
end $$;
create trigger trg_log_heatmaps after insert or update or delete on public.heatmaps
  for each row execute function public.trg_log_heatmaps();

-- sharing notifies the person it is shared with
create or replace function public.trg_log_design_shares() returns trigger language plpgsql security definer set search_path = public as $$
declare
  d public.designs;
begin
  select * into d from public.designs where id = new.design_id;
  if d.id is not null then
    perform public.log_activity(d.organisation_id, 'shared', 'design', d.id, d.name, null, new.user_id, new.permission);
  end if;
  return null;
end $$;
create trigger trg_log_design_shares after insert on public.design_shares
  for each row execute function public.trg_log_design_shares();

create or replace function public.trg_log_heatmap_shares() returns trigger language plpgsql security definer set search_path = public as $$
declare
  h public.heatmaps;
begin
  select * into h from public.heatmaps where id = new.heatmap_id;
  if h.id is not null then
    perform public.log_activity(h.organisation_id, 'shared', 'heatmap', h.id, h.name, h.site_id, new.user_id, new.permission);
  end if;
  return null;
end $$;
create trigger trg_log_heatmap_shares after insert on public.heatmap_shares
  for each row execute function public.trg_log_heatmap_shares();
