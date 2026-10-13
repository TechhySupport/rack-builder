-- Job title shown next to a member (for example "Network Engineer").
alter table public.organisation_members add column if not exists job_title text
  check (job_title is null or char_length(job_title) <= 100);
alter table public.organisation_invitations add column if not exists job_title text
  check (job_title is null or char_length(job_title) <= 100);

create or replace function public.accept_invitation(raw_token text)
returns json language plpgsql security definer
set search_path = public, extensions as $$
declare
  v_token_hash text;
  v_invite     public.organisation_invitations%rowtype;
  v_org_name   text;
begin
  if raw_token is null or char_length(raw_token) < 10 then
    return json_build_object('error', 'Invalid invite code');
  end if;

  v_token_hash := encode(digest(raw_token, 'sha256'), 'hex');

  select * into v_invite
  from public.organisation_invitations
  where token_hash = v_token_hash
    and status = 'pending'
    and expires_at > now();

  if not found then
    return json_build_object('error', 'Invalid or expired invite code');
  end if;

  insert into public.organisation_members
    (organisation_id, user_id, role, invited_by, status, job_title)
  values
    (v_invite.organisation_id, auth.uid(), v_invite.invited_role,
     v_invite.invited_by, 'active', v_invite.job_title)
  on conflict (organisation_id, user_id) do nothing;

  update public.organisation_invitations
  set status = 'accepted',
      accepted_by = auth.uid(),
      accepted_at = now()
  where id = v_invite.id;

  select name into v_org_name
  from public.organisations
  where id = v_invite.organisation_id;

  return json_build_object(
    'organisation_id', v_invite.organisation_id,
    'organisation_name', v_org_name,
    'role', v_invite.invited_role::text
  );
end;
$$;
grant execute on function public.accept_invitation(text) to authenticated;
