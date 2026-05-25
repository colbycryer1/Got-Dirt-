-- Phase 4: Per-material rates on Pit
-- Run in Supabase SQL Editor

ALTER TABLE "Pit"
  ADD COLUMN IF NOT EXISTS "materialRatesCents" JSONB NOT NULL DEFAULT '{}';
