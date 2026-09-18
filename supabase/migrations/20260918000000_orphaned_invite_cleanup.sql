-- ============================================================
-- Helper to safely identify an invited-but-never-used ghost account
-- so a cancelled invitation can clean up the orphaned auth user
-- without ever touching a real, active person's account.
-- ============================================================

create or replace function public.find_deletable_invited_user(p_email citext)
returns uuid
language sql
security definer
set search_path = public, auth
as $$
  select u.id
  from auth.users u
  where u.email = p_email
    and u.last_sign_in_at is null
    and not exists (
      select 1 from public.organisation_members m where m.user_id = u.id
    )
  limit 1;
$$;

-- Only callable by trusted server-side code (service role via edge functions).
revoke all on function public.find_deletable_invited_user(citext) from public, anon, authenticated;
