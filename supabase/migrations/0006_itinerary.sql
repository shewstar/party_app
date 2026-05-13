create table if not exists itinerary_events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 100),
  description text,
  location text,
  start_time timestamptz,
  end_time timestamptz,
  sort_order int not null default 0,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists itinerary_events_start_idx on itinerary_events (start_time);

create table if not exists itinerary_reactions (
  event_id uuid not null references itinerary_events(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  reaction text not null check (char_length(reaction) between 1 and 4),
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

alter table users add column if not exists is_itinerary_editor boolean not null default false;

alter table itinerary_events enable row level security;
drop policy if exists "anon_all" on itinerary_events;
create policy "anon_all" on itinerary_events for all to anon using (true) with check (true);

alter table itinerary_reactions enable row level security;
drop policy if exists "anon_all" on itinerary_reactions;
create policy "anon_all" on itinerary_reactions for all to anon using (true) with check (true);

alter publication supabase_realtime add table itinerary_events;
alter publication supabase_realtime add table itinerary_reactions;
