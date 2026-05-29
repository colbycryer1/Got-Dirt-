-- Phase 7: Catch-up migration — add all HaulOrder columns added since initial creation
-- Safe to re-run: uses ADD COLUMN IF NOT EXISTS throughout
-- Run this in the Supabase SQL Editor

ALTER TABLE "HaulOrder"
  -- Actual load tracking
  ADD COLUMN IF NOT EXISTS "actualLoads"           INTEGER,
  ADD COLUMN IF NOT EXISTS "driverActualLoads"     INTEGER,

  -- Platform fee snapshot
  ADD COLUMN IF NOT EXISTS "platformFeePercent"    DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "platformFeeCents"      INTEGER          NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "haulerPayoutCents"     INTEGER          NOT NULL DEFAULT 0,

  -- Pit material charge
  ADD COLUMN IF NOT EXISTS "pitMaterialRateCents"   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "pitMaterialFeeCents"    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "pitMaterialPayoutCents" INTEGER NOT NULL DEFAULT 0,

  -- Load type + cost snapshot
  ADD COLUMN IF NOT EXISTS "loadType"              TEXT    NOT NULL DEFAULT 'PICK_UP',
  ADD COLUMN IF NOT EXISTS "dirtCostCents"         INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "haulCostCents"         INTEGER NOT NULL DEFAULT 0,

  -- Broadcast flags
  ADD COLUMN IF NOT EXISTS "broadcast"             BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "pitRateBroadcast"      BOOLEAN NOT NULL DEFAULT false,

  -- Pit owner approval
  ADD COLUMN IF NOT EXISTS "pitOwnerApproved"      BOOLEAN,
  ADD COLUMN IF NOT EXISTS "pitOwnerRespondedAt"   TIMESTAMPTZ,

  -- Buyer/Operator (self-haul) mode
  ADD COLUMN IF NOT EXISTS "buyerOperating"         BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "operatorTruckType"      TEXT,
  ADD COLUMN IF NOT EXISTS "operatorTruckRateCents" INTEGER,

  -- Pit owner load session
  ADD COLUMN IF NOT EXISTS "pitSessionActive"      BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "pitSessionStartedAt"   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "pitSessionStartedBy"   TEXT,

  -- Driver manual arrival failsafe
  ADD COLUMN IF NOT EXISTS "driverManualArrival"   BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "driverManualArrivalAt" TIMESTAMPTZ,

  -- COB settlement
  ADD COLUMN IF NOT EXISTS "pitSessionEndedAt"     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "cobDueAt"              TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "afterHoursFeeCents"    INTEGER NOT NULL DEFAULT 0,

  -- Overage approval
  ADD COLUMN IF NOT EXISTS "overageLoads"          INTEGER,
  ADD COLUMN IF NOT EXISTS "overagePendingAt"      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "overageApproved"       BOOLEAN;
