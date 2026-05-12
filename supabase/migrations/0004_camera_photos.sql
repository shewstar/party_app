create table if not exists camera_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  storage_path text not null,
  photo_url text not null,
  party_day text not null,
  filter_variant text not null,
  taken_at timestamptz default now()
);
create index if not exists camera_photos_user_day_idx on camera_photos (user_id, party_day);
create index if not exists camera_photos_day_idx on camera_photos (party_day);

alter table camera_photos enable row level security;
drop policy if exists "anon_all" on camera_photos;
create policy "anon_all" on camera_photos for all to anon using (true) with check (true);

alter publication supabase_realtime add table camera_photos;

insert into storage.buckets (id, name, public)
values ('camera-photos', 'camera-photos', true)
on conflict (id) do nothing;

drop policy if exists "camera_photos_read" on storage.objects;
create policy "camera_photos_read" on storage.objects for select to anon
  using (bucket_id = 'camera-photos');

drop policy if exists "camera_photos_write" on storage.objects;
create policy "camera_photos_write" on storage.objects for insert to anon
  with check (bucket_id = 'camera-photos');
