-- Phase 3: Pit Claims + Saved Pits
-- Run in Supabase SQL Editor

DO $$ BEGIN
  CREATE TYPE "ClaimStatus" AS ENUM ('PENDING','APPROVED','REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "PitClaim" (
  "id"          TEXT PRIMARY KEY,
  "pitId"       TEXT NOT NULL REFERENCES "Pit"("id"),
  "claimantId"  TEXT NOT NULL REFERENCES "User"("id"),
  "status"      "ClaimStatus" NOT NULL DEFAULT 'PENDING',
  "message"     TEXT,
  "adminNotes"  TEXT,
  "reviewedBy"  TEXT,
  "reviewedAt"  TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("pitId", "claimantId")
);
CREATE INDEX IF NOT EXISTS "PitClaim_pitId_idx"      ON "PitClaim"("pitId");
CREATE INDEX IF NOT EXISTS "PitClaim_claimantId_idx" ON "PitClaim"("claimantId");
CREATE INDEX IF NOT EXISTS "PitClaim_status_idx"     ON "PitClaim"("status");

CREATE TABLE IF NOT EXISTS "SavedPit" (
  "id"        TEXT PRIMARY KEY,
  "userId"    TEXT NOT NULL REFERENCES "User"("id"),
  "pitId"     TEXT NOT NULL REFERENCES "Pit"("id"),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("userId", "pitId")
);
CREATE INDEX IF NOT EXISTS "SavedPit_userId_idx" ON "SavedPit"("userId");
CREATE INDEX IF NOT EXISTS "SavedPit_pitId_idx"  ON "SavedPit"("pitId");
