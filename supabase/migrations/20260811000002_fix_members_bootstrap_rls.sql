-- Fix: the initial owner insert was blocked because my_org_role() returned NULL
-- (no existing rows) before the first member row could be written.
-- The bootstrap clause allows the org owner to insert themselves as the first member.

drop policy if exists "members: owner or admin insert" on public.organisation_members;
create policy "members: owner or admin insert"
  on public.organisation_members for insert
  with check (
    -- Normal path: existing owner/admin adding members.
    public.my_org_role(organisation_id) in ('owner', 'admin')
    or (
      -- Bootstrap path: the org owner inserting themselves as the first member.
      auth.uid() = user_id
      and exists (
        select 1 from public.organisations
        where id = organisation_id
          and owner_id = auth.uid()
      )
    )
  );
