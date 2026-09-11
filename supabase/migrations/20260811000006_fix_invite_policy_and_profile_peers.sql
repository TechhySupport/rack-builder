-- Fix 1: replace auth.users subquery with auth.email() built-in
drop policy "invites: invitee read own" on public.organisation_invitations;
create policy "invites: invitee read own"
  on public.organisation_invitations for select
  using (
    public.my_org_role(organisation_id) in ('owner', 'admin')
    OR lower(invited_email::text) = lower(coalesce(auth.email(), ''))
  );
-- Fix 2: org members can read each other's profile names
-- security definer avoids self-referential RLS on organisation_members
create or replace function public.shares_org_with_me(other_user_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1
    from public.organisation_members m1
    join public.organisation_members m2 on m1.organisation_id = m2.organisation_id
    where m1.user_id = auth.uid()
      and m2.user_id = other_user_id
      and m1.status = 'active'
  );
$$;
grant execute on function public.shares_org_with_me(uuid) to authenticated;
create policy "profiles: org peers read"
  on public.profiles for select
  using (public.shares_org_with_me(id));
