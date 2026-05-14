-- Migration: 0009_agency_verification
-- Adds verification columns to the users table.

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "is_verified" boolean DEFAULT false NOT NULL;

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "ntb_registration_number" varchar;

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "license_document_url" varchar;

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "verification_status" varchar DEFAULT 'unsubmitted' NOT NULL;

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "verification_note" text;
