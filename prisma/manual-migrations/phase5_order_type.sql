-- Phase 5: Order type (BORROW vs DUMP)
-- Run in Supabase SQL Editor

DO $$ BEGIN
  CREATE TYPE "OrderType" AS ENUM ('BORROW', 'DUMP');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "orderType" "OrderType" NOT NULL DEFAULT 'BORROW';
