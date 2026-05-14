-- Migration: 0000_initial_schema
-- Generated from current Drizzle schema (lib/db/src/schema/*)
-- Run via: pnpm --filter @workspace/db db:migrate

CREATE TABLE IF NOT EXISTS "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);

CREATE TABLE IF NOT EXISTS "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar UNIQUE,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"role" varchar,
	"agency_name" varchar,
	"bio" varchar(1000),
	"phone" varchar,
	"location" varchar,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "treks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" varchar NOT NULL,
	"title" varchar(255) NOT NULL,
	"destination" varchar(255) NOT NULL,
	"duration" integer NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"price" numeric(10, 2) NOT NULL,
	"max_group_size" integer NOT NULL,
	"description" text NOT NULL,
	"image_url" varchar,
	"status" varchar DEFAULT 'active' NOT NULL,
	"current_participants" integer DEFAULT 0 NOT NULL,
	"difficulty_level" varchar DEFAULT 'moderate' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "join_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trek_id" varchar NOT NULL,
	"trekker_id" varchar NOT NULL,
	"agency_id" varchar NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "custom_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trekker_id" varchar NOT NULL,
	"destination" varchar(255) NOT NULL,
	"budget" numeric(10, 2) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"group_size" integer DEFAULT 1 NOT NULL,
	"notes" text,
	"status" varchar DEFAULT 'open' NOT NULL,
	"selected_bid_id" varchar,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "bids" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"custom_request_id" varchar NOT NULL,
	"agency_id" varchar NOT NULL,
	"proposed_price" numeric(10, 2) NOT NULL,
	"plan_description" text NOT NULL,
	"message" text,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "bookings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trekker_id" varchar NOT NULL,
	"trek_id" varchar,
	"bid_id" varchar,
	"total_amount" numeric(10, 2) NOT NULL,
	"advance_amount" numeric(10, 2) NOT NULL,
	"status" varchar DEFAULT 'paid' NOT NULL,
	"payment_ref" varchar,
	"cancellation_policy" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "notifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"title" varchar NOT NULL,
	"message" text NOT NULL,
	"type" varchar NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "discussion_threads" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(200) NOT NULL,
	"body" text NOT NULL,
	"author_id" varchar NOT NULL,
	"author_name" varchar,
	"author_role" varchar,
	"reply_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "thread_replies" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" varchar NOT NULL,
	"body" text NOT NULL,
	"author_id" varchar NOT NULL,
	"author_name" varchar,
	"author_role" varchar,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "sessions" ("expire");
