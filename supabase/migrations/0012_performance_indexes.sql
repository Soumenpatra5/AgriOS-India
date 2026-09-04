-- Performance pass, wave 1 — indexes the audit showed queries actually need,
-- and one it showed nothing needs.
--
-- Every index here was cross-checked against a real query in api/ before
-- being added; none is speculative. All are additive and safe on live data
-- at current row counts (the largest affected table has tens of rows —
-- these exist so the marketplace does not degrade linearly as it grows,
-- not because anything is slow today).

-- The marketplace's hottest public query: the browse feed.
-- listings.js orders by (created_at DESC, id DESC) with a keyset cursor,
-- filtered to active + not-deleted; the existing (status, category) partial
-- index cannot serve that sort, so every page sorted all active listings.
create index if not exists idx_listings_feed
  on listings (status, created_at desc, id desc) where deleted_at is null;

-- Every product-detail view runs two queries filtered by subject —
-- previously two sequential full-table scans of reviews per view.
create index if not exists idx_reviews_subject
  on reviews (subject_type, subject_id, created_at desc);

-- Postgres does not index foreign keys automatically. These three are each
-- looked up by exactly this key on hot paths (order detail, listing detail,
-- and the Razorpay webhook — the last inside a FOR UPDATE transaction,
-- where a seq scan holds locks longer than it should).
create index if not exists idx_order_items_order on order_items (order_id);
create index if not exists idx_listing_media_listing on listing_media (listing_id);
create index if not exists idx_payments_provider_order on payments (provider_order_id);

-- Added in 0010 for a "messages that mention me" query that was never
-- built; until it is, this only taxes every message insert. The migration
-- adding that query can recreate it.
drop index if exists idx_farm_chat_messages_mentions;
