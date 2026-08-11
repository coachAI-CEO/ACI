-- Baseline migration: records the "clubs" table's already-existing shape in
-- Prisma's migration history without executing anything against the real
-- database. The table itself was created at runtime by hand-rolled raw SQL
-- in services/clubs-store.ts (CREATE TABLE IF NOT EXISTS), entirely outside
-- Prisma's migration history -- this file exists so `prisma migrate resolve
-- --applied` has something on record that matches reality, before the next
-- migration adds Prisma-managed columns/tables on top of it.
--
-- This file documents the pre-existing shape; it is marked as applied via
-- `prisma migrate resolve --applied`, NOT run directly, so the IF NOT EXISTS
-- guards below are a safety net only, never expected to actually fire.

CREATE TABLE IF NOT EXISTS "clubs" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "game_model_id" TEXT NOT NULL,
  "description" TEXT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_by" TEXT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "clubs_name_unique_idx" ON "clubs" ("name");
CREATE UNIQUE INDEX IF NOT EXISTS "clubs_code_lower_unique_idx" ON "clubs" (LOWER("code"));
CREATE INDEX IF NOT EXISTS "clubs_active_idx" ON "clubs" ("active");
