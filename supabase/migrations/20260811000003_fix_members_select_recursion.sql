-- The original SELECT policy queried organisation_members inside its own USING
-- clause, causing Postgres infinite recursion. Replace it with a non-recursive
-- version: own rows are always visible; other org members are visible via the
-- security-definer my_org_role() which bypasses RLS on the table.

drop policy if exists "members: org members read" on public.organisation_members;
create policy "members: org members read"
  on public.organisation_members for select
  using (
    user_id = auth.uid()
    or public.my_org_role(organisation_id) is not null
  );
