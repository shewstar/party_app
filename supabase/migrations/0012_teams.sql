-- Team game support.
alter table games add column if not exists team_count int;
alter table game_players add column if not exists team_index int;
