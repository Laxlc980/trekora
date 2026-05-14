-- Migration: 0006_emergency_gear_seasons_teahouses
-- Adds emergency contacts, gear marketplace, seasonal pricing, and teahouse check-in tables.

-- Emergency contacts
CREATE TABLE IF NOT EXISTS "emergency_contacts" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar NOT NULL,
  "name" varchar(255) NOT NULL,
  "relationship" varchar(50) NOT NULL,
  "phone" varchar(50) NOT NULL,
  "email" varchar,
  "is_primary" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "IDX_emergency_contacts_user_id" ON "emergency_contacts" ("user_id");

-- Gear rentals (agency listings)
CREATE TABLE IF NOT EXISTS "gear_rentals" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "agency_id" varchar NOT NULL,
  "item_name" varchar(255) NOT NULL,
  "description" text,
  "price_per_day" numeric(10,2) NOT NULL,
  "deposit_amount" numeric(10,2) DEFAULT 0 NOT NULL,
  "available" boolean DEFAULT true NOT NULL,
  "image_url" varchar,
  "category" varchar(50) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "IDX_gear_rentals_agency_id" ON "gear_rentals" ("agency_id");
CREATE INDEX IF NOT EXISTS "IDX_gear_rentals_category" ON "gear_rentals" ("category");

-- Secondhand gear marketplace
CREATE TABLE IF NOT EXISTS "secondhand_gear" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "seller_id" varchar NOT NULL,
  "title" varchar(255) NOT NULL,
  "description" text,
  "price_npr" numeric(10,2) NOT NULL,
  "condition" varchar(20) NOT NULL,
  "image_url" varchar,
  "category" varchar(50) NOT NULL,
  "sold" boolean DEFAULT false NOT NULL,
  "location" varchar(255),
  "contact_preference" varchar(10) DEFAULT 'dm' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "IDX_secondhand_gear_seller_id" ON "secondhand_gear" ("seller_id");
CREATE INDEX IF NOT EXISTS "IDX_secondhand_gear_category" ON "secondhand_gear" ("category");

-- Trek pricing seasons
CREATE TABLE IF NOT EXISTS "trek_pricing_seasons" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "trek_id" varchar NOT NULL,
  "season_name" varchar(100) NOT NULL,
  "start_date" date NOT NULL,
  "end_date" date NOT NULL,
  "price_multiplier" numeric(4,2) DEFAULT 1.00 NOT NULL,
  "label" varchar(20) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "IDX_trek_pricing_seasons_trek_id" ON "trek_pricing_seasons" ("trek_id");

-- Teahouses
CREATE TABLE IF NOT EXISTS "teahouses" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(255) NOT NULL,
  "location" varchar(255) NOT NULL,
  "altitude" integer,
  "destination" varchar(255) NOT NULL,
  "latitude" numeric(10,7),
  "longitude" numeric(10,7),
  "facilities" text,
  "price_range" varchar(100),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "IDX_teahouses_destination" ON "teahouses" ("destination");

-- Check-ins
CREATE TABLE IF NOT EXISTS "checkins" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar NOT NULL,
  "teahouse_id" varchar NOT NULL,
  "checkin_date" date NOT NULL,
  "note" text,
  "trail_condition" varchar(20) DEFAULT 'clear' NOT NULL,
  "is_public" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "IDX_checkins_user_id" ON "checkins" ("user_id");
CREATE INDEX IF NOT EXISTS "IDX_checkins_teahouse_id" ON "checkins" ("teahouse_id");

-- Pre-populate teahouses (EBC, Annapurna Circuit, Langtang)
INSERT INTO "teahouses" ("name", "location", "altitude", "destination", "facilities", "price_range") VALUES
  ('Namche Bazaar Lodge', 'Namche Bazaar', 3440, 'Everest Region', '["wifi","hot_shower","restaurant","charging"]', '$$'),
  ('Tengboche Guest House', 'Tengboche', 3867, 'Everest Region', '["restaurant","charging","views"]', '$$'),
  ('Dingboche Lodge', 'Dingboche', 4410, 'Everest Region', '["restaurant","heating","charging"]', '$$$'),
  ('Gorak Shep Inn', 'Gorak Shep', 5164, 'Everest Region', '["restaurant","basic_rooms"]', '$$$'),
  ('Manang Guest House', 'Manang', 3519, 'Annapurna Region', '["wifi","hot_shower","restaurant","bakery"]', '$$'),
  ('Thorong Phedi Lodge', 'Thorong Phedi', 4450, 'Annapurna Region', '["restaurant","dormitory","heating"]', '$$$'),
  ('Muktinath Guest House', 'Muktinath', 3710, 'Annapurna Region', '["wifi","hot_shower","restaurant"]', '$$'),
  ('Ghorepani Poon Hill Lodge', 'Ghorepani', 2860, 'Annapurna Region', '["wifi","hot_shower","restaurant","views"]', '$$'),
  ('Kyanjin Gompa Lodge', 'Kyanjin Gompa', 3870, 'Langtang Region', '["restaurant","cheese_factory","views"]', '$$'),
  ('Lama Hotel', 'Lama Hotel', 2380, 'Langtang Region', '["restaurant","hot_shower","garden"]', '$')
ON CONFLICT DO NOTHING;
