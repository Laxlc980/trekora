-- Migration: 0002_add_username
-- Adds a unique username column to the users table.
-- Nullable so existing rows are unaffected; enforced at the application layer
-- during the role-selection step (POST /users/me/role).

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "username" varchar(20) UNIQUE;
