create table if not exists spins (
  id uuid primary key default gen_random_uuid(),
  spinner_id uuid references users(id) on delete set null,
  winner_id uuid not null references users(id) on delete cascade,
  pool uuid[] not null,
  created_at timestamptz default now()
);
create index if not exists spins_created_idx on spins (created_at desc);

alter table spins enable row level security;
drop policy if exists "anon_all" on spins;
create policy "anon_all" on spins for all to anon using (true) with check (true);

alter publication supabase_realtime add table spins;
