-- Phase 6: Add loadType, dirtCostCents, haulCostCents to HaulOrder
-- These fields snapshot the load-type and estimated costs at order creation time.
-- Run this in the Supabase SQL editor.

ALTER TABLE "HaulOrder"
  ADD COLUMN IF NOT EXISTS "loadType"      TEXT NOT NULL DEFAULT 'PICK_UP',
  ADD COLUMN IF NOT EXISTS "dirtCostCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "haulCostCents" INTEGER NOT NULL DEFAULT 0;
