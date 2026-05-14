-- Migration: 0005_permits
-- Adds permit_types and user_permits tables for the permit purchasing system.

CREATE TABLE IF NOT EXISTS "permit_types" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "destination" varchar(255) NOT NULL,
  "permit_name" varchar(255) NOT NULL,
  "description" text,
  "price_npr" integer NOT NULL,
  "price_usd" integer NOT NULL,
  "issuing_authority" varchar(255) NOT NULL,
  "document_url" varchar,
  "validity_days" integer DEFAULT 30 NOT NULL,
  "required" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "IDX_permit_types_destination" ON "permit_types" ("destination");

CREATE TABLE IF NOT EXISTS "user_permits" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar NOT NULL,
  "permit_type_id" varchar NOT NULL,
  "booking_id" varchar,
  "status" varchar DEFAULT 'pending_payment' NOT NULL,
  "payment_method" varchar,
  "transaction_id" varchar,
  "paid_at" timestamp with time zone,
  "permit_number" varchar,
  "permit_file_url" varchar,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "IDX_user_permits_user_id"         ON "user_permits" ("user_id");
CREATE INDEX IF NOT EXISTS "IDX_user_permits_permit_type_id"  ON "user_permits" ("permit_type_id");
