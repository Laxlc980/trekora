-- Migration: 0010_sos_alerts
-- Adds the SOS emergency alerts table.

CREATE TABLE IF NOT EXISTS "sos_alerts" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar NOT NULL,
  "booking_id" varchar NOT NULL,
  "trek_name" varchar(255) NOT NULL,
  "agency_name" varchar(255),
  "agency_phone" varchar(50),
  "last_known_destination" varchar(255) NOT NULL,
  "latitude" numeric(10,7),
  "longitude" numeric(10,7),
  "triggered_at" timestamp with time zone DEFAULT now() NOT NULL,
  "resolved" boolean DEFAULT false NOT NULL,
  "resolved_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "IDX_sos_alerts_user_id" ON "sos_alerts" ("user_id");
