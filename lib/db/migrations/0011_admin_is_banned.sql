-- Migration: 0011_admin_is_banned
-- Adds isBanned column to users table for admin ban functionality.

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "is_banned" boolean DEFAULT false NOT NULL;
