-- Symmetric rejection: when against_count crosses the same threshold the
-- for-side uses, the card locks as "Rejected". A successful repeal then
-- stamps the existing repealed_at column so both directions are overturned
-- by the same mechanism.

alter table vote_items
  add column if not exists rejected_at timestamptz;
