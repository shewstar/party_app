alter table users
  add constraint users_name_len_chk check (char_length(name) between 1 and 40),
  add constraint users_weight_chk   check (weight_kg is null or (weight_kg >= 20 and weight_kg <= 300));

alter table games
  add constraint games_name_len_chk check (char_length(name) between 1 and 40);

alter table vote_items
  add constraint vote_items_text_len_chk check (char_length(text) between 1 and 140);

alter table drink_entries
  add constraint drink_entries_volume_chk check (volume_ml > 0 and volume_ml <= 2000),
  add constraint drink_entries_abv_chk    check (abv >= 0.001 and abv <= 0.95);
