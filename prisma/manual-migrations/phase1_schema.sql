-- ============================================================
-- GOT DIRT — PHASE 1 SCHEMA MIGRATION
-- Run this in Supabase SQL Editor (Settings → SQL Editor)
-- Safe to re-run: uses IF NOT EXISTS / DO $$ EXCEPTION blocks
-- ============================================================

-- 1. Add new UserRole enum values
DO $$ BEGIN
  ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'BUYER';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'DRIVER';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Create new enum types
DO $$ BEGIN
  CREATE TYPE "OrderStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SettlementStatus" AS ENUM ('PENDING', 'PROCESSED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "VerificationMethod" AS ENUM ('GEOFENCE', 'OPERATOR');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Add new columns to User
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "defaultPaymentMethodId" TEXT;

-- 4. Add new columns to Pit
ALTER TABLE "Pit"
  ADD COLUMN IF NOT EXISTS "operatorProvided"      BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "equipmentProvided"     BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "equipmentNotes"        TEXT,
  ADD COLUMN IF NOT EXISTS "hoursOpen"             TEXT,
  ADD COLUMN IF NOT EXISTS "hoursClose"            TEXT,
  ADD COLUMN IF NOT EXISTS "geofenceRadiusMeters"  INTEGER NOT NULL DEFAULT 200;

-- 5. Create Project table
CREATE TABLE IF NOT EXISTS "Project" (
  "id"                    TEXT NOT NULL DEFAULT gen_random_uuid()::text PRIMARY KEY,
  "buyerUserId"           TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "name"                  TEXT NOT NULL,
  "location"              TEXT,
  "description"           TEXT,
  -- Accounting fields
  "externalJobCode"       TEXT,
  "costCode"              TEXT,
  "glAccountCode"         TEXT,
  "qbAccount"             TEXT,
  "qbClass"               TEXT,
  "costType"              TEXT DEFAULT 'Materials',
  "taxExempt"             BOOLEAN NOT NULL DEFAULT TRUE,
  -- Procore
  "procoreCompanyId"      TEXT,
  "procoreProjectId"      TEXT,
  "procoreVendorId"       TEXT,
  "procoreCostCodeId"     TEXT,
  "procoreLineItemTypeId" TEXT,
  -- ACC
  "accProjectId"          TEXT,
  "accContainerId"        TEXT,
  "accBudgetSegmentId"    TEXT,
  "accCompanyId"          TEXT,
  "createdAt"             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "Project_buyerUserId_idx" ON "Project"("buyerUserId");

-- 6. Create Order table
CREATE TABLE IF NOT EXISTS "Order" (
  "id"                TEXT NOT NULL DEFAULT gen_random_uuid()::text PRIMARY KEY,
  "projectId"         TEXT NOT NULL REFERENCES "Project"("id") ON DELETE RESTRICT,
  "pitId"             TEXT NOT NULL REFERENCES "Pit"("id") ON DELETE RESTRICT,
  "buyerUserId"       TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "status"            "OrderStatus" NOT NULL DEFAULT 'ACTIVE',
  "estimatedLoads"    INTEGER,
  "driverPaymentEnabled" BOOLEAN NOT NULL DEFAULT FALSE,
  -- Snapshot from pit at order time
  "operatorProvided"  BOOLEAN NOT NULL DEFAULT FALSE,
  "equipmentProvided" BOOLEAN NOT NULL DEFAULT FALSE,
  "equipmentNotes"    TEXT,
  "date"              DATE NOT NULL,
  "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "Order_projectId_idx" ON "Order"("projectId");
CREATE INDEX IF NOT EXISTS "Order_pitId_idx"     ON "Order"("pitId");
CREATE INDEX IF NOT EXISTS "Order_buyerUserId_idx" ON "Order"("buyerUserId");
CREATE INDEX IF NOT EXISTS "Order_date_idx"      ON "Order"("date");
CREATE INDEX IF NOT EXISTS "Order_status_idx"    ON "Order"("status");

-- 7. Create LoadEvent table
CREATE TABLE IF NOT EXISTS "LoadEvent" (
  "id"                   TEXT NOT NULL DEFAULT gen_random_uuid()::text PRIMARY KEY,
  "orderId"              TEXT NOT NULL REFERENCES "Order"("id") ON DELETE RESTRICT,
  "pitId"                TEXT NOT NULL REFERENCES "Pit"("id") ON DELETE RESTRICT,
  "driverUserId"         TEXT REFERENCES "User"("id"),
  "operatorUserId"       TEXT REFERENCES "User"("id"),
  "verificationMethod"   "VerificationMethod" NOT NULL,
  "materialType"         TEXT NOT NULL,
  "rateCentsAtTime"      INTEGER NOT NULL,
  "entryTime"            TIMESTAMPTZ,
  "exitTime"             TIMESTAMPTZ,
  "manualConfirmed"      BOOLEAN NOT NULL DEFAULT FALSE,
  "disputed"             BOOLEAN NOT NULL DEFAULT FALSE,
  "verified"             BOOLEAN NOT NULL DEFAULT FALSE,
  "notes"                TEXT,
  "createdAt"            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "LoadEvent_orderId_idx"       ON "LoadEvent"("orderId");
CREATE INDEX IF NOT EXISTS "LoadEvent_pitId_idx"         ON "LoadEvent"("pitId");
CREATE INDEX IF NOT EXISTS "LoadEvent_driverUserId_idx"  ON "LoadEvent"("driverUserId");
CREATE INDEX IF NOT EXISTS "LoadEvent_operatorUserId_idx" ON "LoadEvent"("operatorUserId");
CREATE INDEX IF NOT EXISTS "LoadEvent_verified_idx"      ON "LoadEvent"("verified");
CREATE INDEX IF NOT EXISTS "LoadEvent_createdAt_idx"     ON "LoadEvent"("createdAt");

-- 8. Create Settlement table
CREATE TABLE IF NOT EXISTS "Settlement" (
  "id"                  TEXT NOT NULL DEFAULT gen_random_uuid()::text PRIMARY KEY,
  "orderId"             TEXT NOT NULL REFERENCES "Order"("id") ON DELETE RESTRICT,
  "date"                DATE NOT NULL,
  "verifiedLoadCount"   INTEGER NOT NULL,
  "grossAmountCents"    INTEGER NOT NULL,
  "commissionCents"     INTEGER NOT NULL,
  "netToPitCents"       INTEGER NOT NULL,
  "stripeChargeId"      TEXT,
  "stripeTransferId"    TEXT,
  "status"              "SettlementStatus" NOT NULL DEFAULT 'PENDING',
  "buyerPaymentMethod"  TEXT NOT NULL DEFAULT 'COB',
  "pitPayoutSchedule"   TEXT NOT NULL DEFAULT 'COB',
  "createdAt"           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("orderId", "date")
);
CREATE INDEX IF NOT EXISTS "Settlement_orderId_idx" ON "Settlement"("orderId");
CREATE INDEX IF NOT EXISTS "Settlement_date_idx"    ON "Settlement"("date");
CREATE INDEX IF NOT EXISTS "Settlement_status_idx"  ON "Settlement"("status");

-- 9. Create DriverAssignment table
CREATE TABLE IF NOT EXISTS "DriverAssignment" (
  "id"           TEXT NOT NULL DEFAULT gen_random_uuid()::text PRIMARY KEY,
  "buyerUserId"  TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "driverUserId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "projectId"    TEXT NOT NULL REFERENCES "Project"("id") ON DELETE RESTRICT,
  "active"       BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "DriverAssignment_buyerUserId_idx"  ON "DriverAssignment"("buyerUserId");
CREATE INDEX IF NOT EXISTS "DriverAssignment_driverUserId_idx" ON "DriverAssignment"("driverUserId");
CREATE INDEX IF NOT EXISTS "DriverAssignment_projectId_idx"    ON "DriverAssignment"("projectId");

-- ============================================================
-- DONE — verify with:
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public' ORDER BY table_name;
-- ============================================================
