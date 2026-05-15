create table if not exists piss_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  logged_at timestamptz default now()
);
create index if not exists piss_entries_user_idx on piss_entries (user_id, logged_at desc);

alter table piss_entries enable row level security;
drop policy if exists "anon_all" on piss_entries;
create policy "anon_all" on piss_entries for all to anon using (true) with check (true);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'piss_entries'
  ) then
    alter publication supabase_realtime add table piss_entries;
  end if;
end $$;
