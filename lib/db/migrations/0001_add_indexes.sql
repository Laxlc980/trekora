-- Migration: 0001_add_indexes
-- Adds indexes on all high-frequency WHERE / JOIN columns.

CREATE INDEX IF NOT EXISTS "IDX_treks_agency_id"
  ON "treks" ("agency_id");

CREATE INDEX IF NOT EXISTS "IDX_join_requests_trekker_id"
  ON "join_requests" ("trekker_id");

CREATE INDEX IF NOT EXISTS "IDX_join_requests_trek_id"
  ON "join_requests" ("trek_id");

CREATE INDEX IF NOT EXISTS "IDX_join_requests_agency_id"
  ON "join_requests" ("agency_id");

CREATE INDEX IF NOT EXISTS "IDX_bookings_trekker_id"
  ON "bookings" ("trekker_id");

CREATE INDEX IF NOT EXISTS "IDX_bookings_trek_id"
  ON "bookings" ("trek_id");

CREATE INDEX IF NOT EXISTS "IDX_bids_custom_request_id"
  ON "bids" ("custom_request_id");

CREATE INDEX IF NOT EXISTS "IDX_bids_agency_id"
  ON "bids" ("agency_id");

CREATE INDEX IF NOT EXISTS "IDX_notifications_user_id"
  ON "notifications" ("user_id");

CREATE INDEX IF NOT EXISTS "IDX_custom_requests_trekker_id"
  ON "custom_requests" ("trekker_id");
