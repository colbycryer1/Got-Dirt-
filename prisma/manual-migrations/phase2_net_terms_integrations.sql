-- Phase 2: Net Terms + Integrations
-- Run this in Supabase SQL Editor AFTER phase1_compliance.sql

-- Enums
DO $$ BEGIN
  CREATE TYPE "NetTermsInvoiceStatus" AS ENUM ('OPEN','OVERDUE','PAID','WRITTEN_OFF');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "IntegrationPlatform" AS ENUM ('PROCORE','ACC','QBO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- NetTermsAccount
CREATE TABLE IF NOT EXISTS "NetTermsAccount" (
  "id"               TEXT PRIMARY KEY,
  "buyerUserId"      TEXT NOT NULL UNIQUE REFERENCES "User"("id"),
  "termsDays"        INTEGER NOT NULL DEFAULT 30,
  "creditLimitCents" INTEGER,
  "downPaymentPct"   DOUBLE PRECISION NOT NULL DEFAULT 0,
  "billingPeriodDays" INTEGER NOT NULL DEFAULT 30,
  "notes"            TEXT,
  "assignedBy"       TEXT NOT NULL,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "NetTermsAccount_buyerUserId_idx" ON "NetTermsAccount"("buyerUserId");

-- NetTermsInvoice
CREATE TABLE IF NOT EXISTS "NetTermsInvoice" (
  "id"                    TEXT PRIMARY KEY,
  "netTermsAccountId"     TEXT NOT NULL REFERENCES "NetTermsAccount"("id"),
  "buyerUserId"           TEXT NOT NULL REFERENCES "User"("id"),
  "invoiceNumber"         TEXT NOT NULL UNIQUE,
  "periodStart"           DATE NOT NULL,
  "periodEnd"             DATE NOT NULL,
  "dueDate"               DATE NOT NULL,
  "subtotalCents"         INTEGER NOT NULL,
  "commissionCents"       INTEGER NOT NULL,
  "totalDueCents"         INTEGER NOT NULL,
  "status"                "NetTermsInvoiceStatus" NOT NULL DEFAULT 'OPEN',
  "pdfUrl"                TEXT,
  "stripeInvoiceId"       TEXT UNIQUE,
  "stripePaymentIntentId" TEXT UNIQUE,
  "reminderSentAt"        TIMESTAMP(3),
  "plus3SentAt"           TIMESTAMP(3),
  "plus7SentAt"           TIMESTAMP(3),
  "plus15SentAt"          TIMESTAMP(3),
  "escalatedToAdmin"      BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("buyerUserId", "periodStart", "periodEnd")
);
CREATE INDEX IF NOT EXISTS "NetTermsInvoice_buyerUserId_idx"  ON "NetTermsInvoice"("buyerUserId");
CREATE INDEX IF NOT EXISTS "NetTermsInvoice_status_idx"       ON "NetTermsInvoice"("status");
CREATE INDEX IF NOT EXISTS "NetTermsInvoice_dueDate_idx"      ON "NetTermsInvoice"("dueDate");

-- DownPaymentTransaction
CREATE TABLE IF NOT EXISTS "DownPaymentTransaction" (
  "id"                    TEXT PRIMARY KEY,
  "orderId"               TEXT NOT NULL UNIQUE REFERENCES "Order"("id"),
  "amountCents"           INTEGER NOT NULL,
  "stripePaymentIntentId" TEXT UNIQUE,
  "status"                "TransactionStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- IntegrationConnection
CREATE TABLE IF NOT EXISTS "IntegrationConnection" (
  "id"                TEXT PRIMARY KEY,
  "buyerUserId"       TEXT NOT NULL REFERENCES "User"("id"),
  "platform"          "IntegrationPlatform" NOT NULL,
  "accessTokenEnc"    TEXT NOT NULL,
  "refreshTokenEnc"   TEXT,
  "expiresAt"         TIMESTAMP(3),
  "platformUserId"    TEXT,
  "platformCompanyId" TEXT,
  "platformOrgId"     TEXT,
  "scope"             TEXT,
  "lastSyncAt"        TIMESTAMP(3),
  "lastSyncError"     TEXT,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("buyerUserId", "platform")
);
CREATE INDEX IF NOT EXISTS "IntegrationConnection_buyerUserId_idx" ON "IntegrationConnection"("buyerUserId");
CREATE INDEX IF NOT EXISTS "IntegrationConnection_platform_idx"    ON "IntegrationConnection"("platform");

-- Add netTermsInvoiceId to Settlement
ALTER TABLE "Settlement" ADD COLUMN IF NOT EXISTS "netTermsInvoiceId" TEXT
  REFERENCES "NetTermsInvoice"("id");
CREATE INDEX IF NOT EXISTS "Settlement_netTermsInvoiceId_idx" ON "Settlement"("netTermsInvoiceId");
