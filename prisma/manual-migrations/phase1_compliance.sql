-- Phase 1 Compliance Migration
-- Run this in the Supabase SQL Editor (safe to re-run — uses IF NOT EXISTS)

-- Enums
DO $$ BEGIN
  CREATE TYPE "KycStatus" AS ENUM ('NOT_STARTED','PENDING','VERIFIED','REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "FlagType" AS ENUM ('UNUSUAL_VOLUME','RAPID_LOAD_INCREASE','NEW_ACCOUNT_HIGH_VOLUME','MANUAL_REVIEW');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "FlagResolution" AS ENUM ('CLEARED','ESCALATED','REPORTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- PitOwnerCompliance table
CREATE TABLE IF NOT EXISTS "PitOwnerCompliance" (
  "id"                   TEXT         NOT NULL DEFAULT gen_random_uuid()::text,
  "pitOwnerUserId"       TEXT         NOT NULL,
  "kycStatus"            "KycStatus"  NOT NULL DEFAULT 'NOT_STARTED',
  "kycCompletedAt"       TIMESTAMPTZ,
  "stripeOnboardingUrl"  TEXT,
  "payoutsEnabled"       BOOLEAN      NOT NULL DEFAULT FALSE,
  "chargesEnabled"       BOOLEAN      NOT NULL DEFAULT FALSE,
  "requirementsDue"      TEXT[]       NOT NULL DEFAULT '{}',
  "lastCheckedAt"        TIMESTAMPTZ,
  "createdAt"            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updatedAt"            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT "PitOwnerCompliance_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PitOwnerCompliance_pitOwnerUserId_key" UNIQUE ("pitOwnerUserId"),
  CONSTRAINT "PitOwnerCompliance_pitOwnerUserId_fkey"
    FOREIGN KEY ("pitOwnerUserId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "PitOwnerCompliance_kycStatus_idx" ON "PitOwnerCompliance"("kycStatus");

-- TransactionFlag table
CREATE TABLE IF NOT EXISTS "TransactionFlag" (
  "id"           TEXT             NOT NULL DEFAULT gen_random_uuid()::text,
  "settlementId" TEXT             NOT NULL,
  "flagType"     "FlagType"       NOT NULL,
  "description"  TEXT             NOT NULL,
  "reviewedBy"   TEXT,
  "reviewedAt"   TIMESTAMPTZ,
  "resolution"   "FlagResolution",
  "createdAt"    TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  CONSTRAINT "TransactionFlag_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TransactionFlag_settlementId_fkey"
    FOREIGN KEY ("settlementId") REFERENCES "Settlement"("id") ON DELETE CASCADE,
  CONSTRAINT "TransactionFlag_reviewedBy_fkey"
    FOREIGN KEY ("reviewedBy") REFERENCES "User"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "TransactionFlag_settlementId_idx" ON "TransactionFlag"("settlementId");
CREATE INDEX IF NOT EXISTS "TransactionFlag_resolution_idx"   ON "TransactionFlag"("resolution");

-- Add pitAdvanceByGotdirt to Settlement
ALTER TABLE "Settlement" ADD COLUMN IF NOT EXISTS "pitAdvanceByGotdirt" BOOLEAN NOT NULL DEFAULT FALSE;
