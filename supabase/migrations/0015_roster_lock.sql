-- One-row settings table for party-wide toggles. Mirrors the buck_dry_state
-- pattern in 0009_push_subscriptions.sql — singleton via a CHECK constraint
-- on id, seeded with a default row, permissive RLS like the rest of the app.

create table if not exists app_settings (
  id int primary key default 1,
  roster_locked boolean not null default false,
  updated_at timestamptz default now(),
  constraint app_settings_singleton check (id = 1)
);
insert into app_settings (id) values (1) on conflict (id) do nothing;

alter table app_settings enable row level security;
drop policy if exists "anon_all" on app_settings;
create policy "anon_all" on app_settings for all to anon using (true) with check (true);

-- Realtime: every other table is published to `supabase_realtime` so the
-- in-app cache stays live without polling. Without this, the roster-lock
-- toggle doesn't propagate to other devices. Idempotent so re-running the
-- migration after the table was already added doesn't error.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'app_settings'
  ) then
    alter publication supabase_realtime add table app_settings;
  end if;
end $$;
