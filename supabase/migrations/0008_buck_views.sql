create or replace view v_drinks_leaderboard as
  select u.id, u.name, u.avatar_url,
         coalesce(count(d.id), 0)::int as drink_count,
         coalesce(sum(d.standard_drinks), 0)::numeric as standard_drinks,
         u.is_buck
  from users u
  left join drink_entries d on d.user_id = u.id
  group by u.id, u.is_buck;

create or replace view v_game_totals as
  select g.id as game_id, g.name as game_name,
         u.id as user_id, u.name as user_name, u.avatar_url,
         coalesce(sum(s.score), 0)::numeric as total_score,
         u.is_buck
  from games g
  join game_players gp on gp.game_id = g.id
  join users u on u.id = gp.user_id
  left join game_scores s on s.game_id = g.id and s.user_id = u.id
  group by g.id, g.name, u.id, u.name, u.avatar_url, u.is_buck;
