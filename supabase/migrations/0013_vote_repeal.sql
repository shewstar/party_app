-- Vote repeal: link a "repeal" vote_item back to the original it overturns,
-- and stamp the original when the repeal passes so the UI can render it
-- with a strikethrough instead of deleting history.

alter table vote_items
  add column if not exists repeals_vote_item_id uuid
    references vote_items(id) on delete set null,
  add column if not exists repealed_at timestamptz;

create index if not exists vote_items_repeals_idx
  on vote_items(repeals_vote_item_id);
