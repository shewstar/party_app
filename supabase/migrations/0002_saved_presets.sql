alter table drink_entries
  add column if not exists is_saved_preset boolean not null default false;

create index if not exists drink_entries_saved_idx
  on drink_entries (user_id, category)
  where is_saved_preset;
