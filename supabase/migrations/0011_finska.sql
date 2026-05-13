-- Finska (Mölkky) game preset.
-- Adds an optional preset tag on games and a locked random throw order on
-- game_players. Both columns stay NULL for existing/generic games.

alter table games add column if not exists preset text;
create index if not exists games_preset_idx on games (preset);

alter table game_players add column if not exists throw_order int;
