-- Migration: 0003_add_bid_rejection_message
-- Adds a nullable rejection_message column to the bids table.

ALTER TABLE "bids"
  ADD COLUMN IF NOT EXISTS "rejection_message" text;
