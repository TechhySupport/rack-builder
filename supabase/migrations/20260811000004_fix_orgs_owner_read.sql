-- The owner couldn't read back the just-inserted org row because the only
-- SELECT policy checks organisation_members (which is empty at that point).
-- Allow the org owner to always read their own org.

create policy "orgs: owner read"
  on public.organisations for select
  using (owner_id = auth.uid());
