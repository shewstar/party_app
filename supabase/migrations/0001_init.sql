-- Bucks Party App — initial schema.
-- Single implicit shared room. No auth; users carry a client-generated UUID.

create extension if not exists "pgcrypto";

create table if not exists users (
  id uuid primary key,
  name text not null,
  weight_kg numeric,
  sex text check (sex in ('male','female','other')),
  first_drink_at timestamptz,
  avatar_url text,
  created_at timestamptz default now()
);

create table if not exists drink_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  category text not null check (category in ('beer','wine','spirits')),
  label text,
  volume_ml numeric not null,
  abv numeric not null,
  standard_drinks numeric not null,
  logged_at timestamptz default now()
);
create index if not exists drink_entries_user_idx on drink_entries (user_id, logged_at desc);

create table if not exists vote_items (
  id uuid primary key default gen_random_uuid(),
  proposer_id uuid references users(id) on delete set null,
  text text not null,
  created_at timestamptz default now()
);

create table if not exists vote_responses (
  vote_item_id uuid references vote_items(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  value smallint not null check (value in (-1, 1)),
  updated_at timestamptz default now(),
  primary key (vote_item_id, user_id)
);

create table if not exists games (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

create table if not exists game_players (
  game_id uuid references games(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  primary key (game_id, user_id)
);

create table if not exists game_scores (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references games(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  score numeric not null,
  recorded_at timestamptz default now()
);
create index if not exists game_scores_game_idx on game_scores (game_id, recorded_at desc);

-- Convenience views.
create or replace view v_drinks_leaderboard as
  select u.id, u.name, u.avatar_url,
         coalesce(count(d.id), 0)::int as drink_count,
         coalesce(sum(d.standard_drinks), 0)::numeric as standard_drinks
  from users u
  left join drink_entries d on d.user_id = u.id
  group by u.id;

create or replace view v_vote_tally as
  select vi.id, vi.text, vi.proposer_id, vi.created_at,
         coalesce(sum(case when vr.value = 1 then 1 else 0 end), 0)::int as for_count,
         coalesce(sum(case when vr.value = -1 then 1 else 0 end), 0)::int as against_count,
         coalesce(sum(vr.value), 0)::int as net
  from vote_items vi
  left join vote_responses vr on vr.vote_item_id = vi.id
  group by vi.id;

create or replace view v_game_totals as
  select g.id as game_id, g.name as game_name,
         u.id as user_id, u.name as user_name, u.avatar_url,
         coalesce(sum(s.score), 0)::numeric as total_score
  from games g
  join game_players gp on gp.game_id = g.id
  join users u on u.id = gp.user_id
  left join game_scores s on s.game_id = g.id and s.user_id = u.id
  group by g.id, g.name, u.id, u.name, u.avatar_url;

-- Permissive RLS — single private party room.
alter table users enable row level security;
alter table drink_entries enable row level security;
alter table vote_items enable row level security;
alter table vote_responses enable row level security;
alter table games enable row level security;
alter table game_players enable row level security;
alter table game_scores enable row level security;

do $$
declare t text;
begin
  for t in select unnest(array[
    'users','drink_entries','vote_items','vote_responses',
    'games','game_players','game_scores'
  ]) loop
    execute format('drop policy if exists "anon_all" on %I', t);
    execute format(
      'create policy "anon_all" on %I for all to anon using (true) with check (true)',
      t
    );
  end loop;
end $$;

-- Realtime publication.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

alter publication supabase_realtime add table users, drink_entries, vote_items, vote_responses, game_scores, games, game_players;

-- Storage: run once in Supabase dashboard or via SQL:
-- insert into storage.buckets (id, name, public) values ('avatars','avatars', true)
--   on conflict (id) do nothing;
