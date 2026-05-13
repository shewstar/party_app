-- Dev-only helper: wipes all data, keeps schema.
create or replace function public.reset_all_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  truncate table
    users,
    drink_entries,
    vote_items,
    vote_responses,
    games,
    game_players,
    game_scores,
    spins,
    camera_photos,
    itinerary_events,
    itinerary_reactions,
    app_opens,
    push_subscriptions,
    buck_dry_state
  restart identity cascade;
end;
$$;

revoke all on function public.reset_all_data() from public, anon, authenticated;
grant execute on function public.reset_all_data() to service_role;
