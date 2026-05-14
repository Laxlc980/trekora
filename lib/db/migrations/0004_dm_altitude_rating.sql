-- Migration: 0004_dm_altitude_rating
-- Adds DM tables, trek max altitude, and booking rating.

-- Direct message request table
CREATE TABLE IF NOT EXISTS "dm_requests" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "from_user_id" varchar NOT NULL,
  "to_user_id" varchar NOT NULL,
  "status" varchar DEFAULT 'pending' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "IDX_dm_requests_from_user_id" ON "dm_requests" ("from_user_id");
CREATE INDEX IF NOT EXISTS "IDX_dm_requests_to_user_id"   ON "dm_requests" ("to_user_id");

-- Direct message body table
CREATE TABLE IF NOT EXISTS "dm_messages" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "conversation_id" varchar NOT NULL,
  "sender_id" varchar NOT NULL,
  "body" text NOT NULL,
  "read" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "IDX_dm_messages_conversation_id" ON "dm_messages" ("conversation_id");
CREATE INDEX IF NOT EXISTS "IDX_dm_messages_sender_id"       ON "dm_messages" ("sender_id");

-- Trek max altitude
ALTER TABLE "treks"
  ADD COLUMN IF NOT EXISTS "max_altitude_meters" integer;

-- Booking rating (1–5)
ALTER TABLE "bookings"
  ADD COLUMN IF NOT EXISTS "rating" integer;
