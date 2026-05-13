create table if not exists app_opens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  party_day date not null,
  opened_at timestamptz not null default now()
);
create index if not exists app_opens_user_day_idx on app_opens (user_id, party_day);
create index if not exists app_opens_opened_idx on app_opens (opened_at);

alter table app_opens enable row level security;
drop policy if exists "anon_all" on app_opens;
create policy "anon_all" on app_opens for all to anon using (true) with check (true);

alter publication supabase_realtime add table app_opens;
