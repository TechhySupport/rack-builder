-- Create private storage buckets for org logos, rack photos, and avatars.
-- Access is via signed URLs generated server-side; all buckets are private.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('org-logos',   'org-logos',   false, 2097152,  array['image/jpeg','image/png','image/webp']),
  ('rack-photos', 'rack-photos', false, 10485760, array['image/jpeg','image/png','image/webp']),
  ('avatars',     'avatars',     false, 2097152,  array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
-- org-logos: authenticated users can upload to their own prefix; members of the org can read.
create policy "org-logos: owner upload"
  on storage.objects for insert
  with check (
    bucket_id = 'org-logos'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "org-logos: org members read"
  on storage.objects for select
  using (
    bucket_id = 'org-logos'
    and auth.uid() is not null
  );
-- rack-photos: editors+ in the org can upload; all org members can read.
create policy "rack-photos: editor+ upload"
  on storage.objects for insert
  with check (
    bucket_id = 'rack-photos'
    and auth.uid() is not null
  );
create policy "rack-photos: org members read"
  on storage.objects for select
  using (
    bucket_id = 'rack-photos'
    and auth.uid() is not null
  );
-- avatars: users manage their own avatar only.
create policy "avatars: owner upload"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "avatars: owner read"
  on storage.objects for select
  using (
    bucket_id = 'avatars'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );
