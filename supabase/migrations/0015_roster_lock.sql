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
