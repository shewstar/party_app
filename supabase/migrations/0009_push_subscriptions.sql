-- Web Push notifications.

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz default now()
);
create index if not exists push_subscriptions_user_idx on push_subscriptions (user_id);

alter table push_subscriptions enable row level security;
drop policy if exists "anon_all" on push_subscriptions;
create policy "anon_all" on push_subscriptions for all to anon using (true) with check (true);

-- Track when a vote item crossed majority so we only notify once.
alter table vote_items add column if not exists passed_at timestamptz;

-- Track last buck-dry alert to avoid hourly spam.
create table if not exists buck_dry_state (
  id int primary key default 1,
  last_notified_at timestamptz,
  last_drink_at timestamptz,
  constraint buck_dry_state_singleton check (id = 1)
);
insert into buck_dry_state (id) values (1) on conflict (id) do nothing;

alter table buck_dry_state enable row level security;
drop policy if exists "anon_all" on buck_dry_state;
create policy "anon_all" on buck_dry_state for all to anon using (true) with check (true);
