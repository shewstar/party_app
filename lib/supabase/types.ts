export type Sex = "male" | "female" | "other";
export type DrinkCategory = "beer" | "wine" | "spirits";

export type UserRow = {
  id: string;
  name: string;
  weight_kg: number | null;
  sex: Sex | null;
  first_drink_at: string | null;
  avatar_url: string | null;
  is_itinerary_editor: boolean;
  created_at: string;
};

export type DrinkRow = {
  id: string;
  user_id: string;
  category: DrinkCategory;
  label: string | null;
  volume_ml: number;
  abv: number;
  standard_drinks: number;
  logged_at: string;
  is_saved_preset: boolean;
};

export type VoteItemRow = {
  id: string;
  proposer_id: string | null;
  text: string;
  created_at: string;
};

export type VoteResponseRow = {
  vote_item_id: string;
  user_id: string;
  value: 1 | -1;
  updated_at: string;
};

export type GameRow = {
  id: string;
  name: string;
  created_at: string;
};

export type GamePlayerRow = {
  game_id: string;
  user_id: string;
};

export type GameScoreRow = {
  id: string;
  game_id: string;
  user_id: string;
  score: number;
  recorded_at: string;
};

export type DrinksLeaderboardRow = {
  id: string;
  name: string;
  avatar_url: string | null;
  drink_count: number;
  standard_drinks: number;
};

export type VoteTallyRow = {
  id: string;
  text: string;
  proposer_id: string | null;
  created_at: string;
  for_count: number;
  against_count: number;
  net: number;
};

export type GameTotalsRow = {
  game_id: string;
  game_name: string;
  user_id: string;
  user_name: string;
  avatar_url: string | null;
  total_score: number;
};

export type SpinRow = {
  id: string;
  spinner_id: string | null;
  winner_id: string;
  pool: string[];
  created_at: string;
};

export type ItineraryEventRow = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_time: string | null;
  end_time: string | null;
  sort_order: number;
  created_by: string | null;
  created_at: string;
};

export type ItineraryReactionRow = {
  event_id: string;
  user_id: string;
  reaction: string;
  created_at: string;
};

export type FilterVariant = "warm" | "cool";

export type CameraPhotoRow = {
  id: string;
  user_id: string;
  storage_path: string;
  photo_url: string;
  party_day: string;
  filter_variant: FilterVariant;
  taken_at: string;
};

