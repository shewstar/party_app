insert into storage.buckets (id, name, public)
values ('camera-photos', 'camera-photos', true)
on conflict (id) do update set public = true;

drop policy if exists "camera_photos_read" on storage.objects;
drop policy if exists "camera_photos_write" on storage.objects;

create policy "camera_photos_read"
  on storage.objects for select
  using (bucket_id = 'camera-photos');

create policy "camera_photos_write"
  on storage.objects for insert
  with check (bucket_id = 'camera-photos');
