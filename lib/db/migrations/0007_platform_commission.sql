-- Migration: 0007_platform_commission
-- Adds platform fee columns to bookings table.

ALTER TABLE "bookings"
  ADD COLUMN IF NOT EXISTS "platform_fee_percent" numeric(5,2) DEFAULT 5.00 NOT NULL;

ALTER TABLE "bookings"
  ADD COLUMN IF NOT EXISTS "platform_fee_amount" numeric(10,2) DEFAULT 0 NOT NULL;
