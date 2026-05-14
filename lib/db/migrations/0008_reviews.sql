-- Migration: 0008_reviews
-- Adds the reviews table with a unique constraint on booking_id.

CREATE TABLE IF NOT EXISTS "reviews" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "booking_id" varchar NOT NULL,
  "trek_id" varchar NOT NULL,
  "agency_id" varchar NOT NULL,
  "trekker_id" varchar NOT NULL,
  "rating" integer NOT NULL,
  "title" varchar(100) NOT NULL,
  "body" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "UQ_reviews_booking_id" UNIQUE ("booking_id")
);

CREATE INDEX IF NOT EXISTS "IDX_reviews_trek_id"    ON "reviews" ("trek_id");
CREATE INDEX IF NOT EXISTS "IDX_reviews_agency_id"  ON "reviews" ("agency_id");
CREATE INDEX IF NOT EXISTS "IDX_reviews_trekker_id" ON "reviews" ("trekker_id");
