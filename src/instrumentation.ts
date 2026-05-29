// Runs once per server cold-start (Vercel lambda init, local dev restart).
// Adds any schema columns committed without a migration file.
// Uses ADD COLUMN IF NOT EXISTS so every block is fully idempotent.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { prisma } = await import("@/lib/prisma");

  // ── HaulOrder ────────────────────────────────────────────────────────────
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "HaulOrder"
        ADD COLUMN IF NOT EXISTS "actualLoads"            INTEGER,
        ADD COLUMN IF NOT EXISTS "driverActualLoads"      INTEGER,
        ADD COLUMN IF NOT EXISTS "platformFeePercent"     DOUBLE PRECISION NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "platformFeeCents"       INTEGER          NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "haulerPayoutCents"      INTEGER          NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "pitMaterialRateCents"   INTEGER          NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "pitMaterialFeeCents"    INTEGER          NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "pitMaterialPayoutCents" INTEGER          NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "loadType"               TEXT             NOT NULL DEFAULT 'PICK_UP',
        ADD COLUMN IF NOT EXISTS "dirtCostCents"          INTEGER          NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "haulCostCents"          INTEGER          NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "broadcast"              BOOLEAN          NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "pitRateBroadcast"       BOOLEAN          NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "pitOwnerApproved"       BOOLEAN,
        ADD COLUMN IF NOT EXISTS "pitOwnerRespondedAt"    TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS "buyerOperating"         BOOLEAN          NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "operatorTruckType"      TEXT,
        ADD COLUMN IF NOT EXISTS "operatorTruckRateCents" INTEGER,
        ADD COLUMN IF NOT EXISTS "pitSessionActive"       BOOLEAN          NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "pitSessionStartedAt"    TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS "pitSessionStartedBy"    TEXT,
        ADD COLUMN IF NOT EXISTS "driverManualArrival"    BOOLEAN          NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "driverManualArrivalAt"  TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS "pitSessionEndedAt"      TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS "cobDueAt"               TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS "afterHoursFeeCents"     INTEGER          NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "overageLoads"           INTEGER,
        ADD COLUMN IF NOT EXISTS "overagePendingAt"       TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS "overageApproved"        BOOLEAN
    `);
    console.log("[startup] HaulOrder schema sync: OK");
  } catch (err) {
    console.error("[startup] HaulOrder schema sync failed:", err);
  }

  // ── HaulOrderAmendment ───────────────────────────────────────────────────
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "HaulOrderAmendment"
        ADD COLUMN IF NOT EXISTS "haulerNotes"        TEXT,
        ADD COLUMN IF NOT EXISTS "pitOwnerNotes"      TEXT,
        ADD COLUMN IF NOT EXISTS "processingFeeCents" INTEGER NOT NULL DEFAULT 0
    `);
    console.log("[startup] HaulOrderAmendment schema sync: OK");
  } catch (err) {
    console.error("[startup] HaulOrderAmendment schema sync failed:", err);
  }

  // ── Order ────────────────────────────────────────────────────────────────
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Order"
        ADD COLUMN IF NOT EXISTS "driverPaymentEnabled" BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "operatorProvided"     BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "equipmentProvided"    BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "equipmentNotes"       TEXT
    `);
    console.log("[startup] Order schema sync: OK");
  } catch (err) {
    console.error("[startup] Order schema sync failed:", err);
  }

  // ── Settlement ───────────────────────────────────────────────────────────
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Settlement"
        ADD COLUMN IF NOT EXISTS "buyerPaymentMethod"  TEXT    NOT NULL DEFAULT 'COB',
        ADD COLUMN IF NOT EXISTS "pitPayoutSchedule"   TEXT    NOT NULL DEFAULT 'COB',
        ADD COLUMN IF NOT EXISTS "pitAdvanceByGotdirt" BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "netTermsInvoiceId"   TEXT
    `);
    console.log("[startup] Settlement schema sync: OK");
  } catch (err) {
    console.error("[startup] Settlement schema sync failed:", err);
  }

  // ── Project ──────────────────────────────────────────────────────────────
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Project"
        ADD COLUMN IF NOT EXISTS "location"              TEXT,
        ADD COLUMN IF NOT EXISTS "externalJobCode"       TEXT,
        ADD COLUMN IF NOT EXISTS "costCode"              TEXT,
        ADD COLUMN IF NOT EXISTS "glAccountCode"         TEXT,
        ADD COLUMN IF NOT EXISTS "qbAccount"             TEXT,
        ADD COLUMN IF NOT EXISTS "qbClass"               TEXT,
        ADD COLUMN IF NOT EXISTS "costType"              TEXT DEFAULT 'Materials',
        ADD COLUMN IF NOT EXISTS "taxExempt"             BOOLEAN NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS "procoreCompanyId"      TEXT,
        ADD COLUMN IF NOT EXISTS "procoreProjectId"      TEXT,
        ADD COLUMN IF NOT EXISTS "procoreVendorId"       TEXT,
        ADD COLUMN IF NOT EXISTS "procoreCostCodeId"     TEXT,
        ADD COLUMN IF NOT EXISTS "procoreLineItemTypeId" TEXT,
        ADD COLUMN IF NOT EXISTS "accProjectId"          TEXT,
        ADD COLUMN IF NOT EXISTS "accContainerId"        TEXT,
        ADD COLUMN IF NOT EXISTS "accBudgetSegmentId"    TEXT,
        ADD COLUMN IF NOT EXISTS "accCompanyId"          TEXT
    `);
    console.log("[startup] Project schema sync: OK");
  } catch (err) {
    console.error("[startup] Project schema sync failed:", err);
  }

  // ── PlatformSettings ─────────────────────────────────────────────────────
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "PlatformSettings"
        ADD COLUMN IF NOT EXISTS "haulFeePercent"     DOUBLE PRECISION NOT NULL DEFAULT 10.0,
        ADD COLUMN IF NOT EXISTS "earlyEditFeeCents"  INTEGER          NOT NULL DEFAULT 1000,
        ADD COLUMN IF NOT EXISTS "afterHoursFeeCents" INTEGER          NOT NULL DEFAULT 500,
        ADD COLUMN IF NOT EXISTS "updatedBy"          TEXT
    `);
    console.log("[startup] PlatformSettings schema sync: OK");
  } catch (err) {
    console.error("[startup] PlatformSettings schema sync failed:", err);
  }

  // ── User ─────────────────────────────────────────────────────────────────
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "User"
        ADD COLUMN IF NOT EXISTS "defaultPaymentMethodId" TEXT
    `);
    console.log("[startup] User schema sync: OK");
  } catch (err) {
    console.error("[startup] User schema sync failed:", err);
  }

  // ── Pit ──────────────────────────────────────────────────────────────────
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Pit"
        ADD COLUMN IF NOT EXISTS "materialRatesCents"    JSONB    NOT NULL DEFAULT '{}',
        ADD COLUMN IF NOT EXISTS "operatorProvided"      BOOLEAN  NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "equipmentProvided"     BOOLEAN  NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "equipmentNotes"        TEXT,
        ADD COLUMN IF NOT EXISTS "hoursOpen"             TEXT,
        ADD COLUMN IF NOT EXISTS "hoursClose"            TEXT,
        ADD COLUMN IF NOT EXISTS "geofenceRadiusMeters"  INTEGER  NOT NULL DEFAULT 200,
        ADD COLUMN IF NOT EXISTS "contactName"           TEXT,
        ADD COLUMN IF NOT EXISTS "contactPhone"          TEXT,
        ADD COLUMN IF NOT EXISTS "contactEmail"          TEXT,
        ADD COLUMN IF NOT EXISTS "materialTypes"         TEXT[]   NOT NULL DEFAULT '{}',
        ADD COLUMN IF NOT EXISTS "dailyHaulRateCents"    INTEGER,
        ADD COLUMN IF NOT EXISTS "dailyHaulRateLockedAt" TIMESTAMPTZ
    `);
    console.log("[startup] Pit schema sync: OK");
  } catch (err) {
    console.error("[startup] Pit schema sync failed:", err);
  }

  // ── DriverProfile ────────────────────────────────────────────────────────
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "DriverProfile"
        ADD COLUMN IF NOT EXISTS "additionalDocUrls"   TEXT[]  NOT NULL DEFAULT '{}',
        ADD COLUMN IF NOT EXISTS "liveLocationEnabled" BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "currentLat"          DOUBLE PRECISION,
        ADD COLUMN IF NOT EXISTS "currentLng"          DOUBLE PRECISION,
        ADD COLUMN IF NOT EXISTS "lastLocationAt"      TIMESTAMPTZ
    `);
    console.log("[startup] DriverProfile schema sync: OK");
  } catch (err) {
    console.error("[startup] DriverProfile schema sync failed:", err);
  }

  // ── CarrierProfile ───────────────────────────────────────────────────────
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "CarrierProfile"
        ADD COLUMN IF NOT EXISTS "website"       TEXT,
        ADD COLUMN IF NOT EXISTS "haulRateCents" INTEGER
    `);
    console.log("[startup] CarrierProfile schema sync: OK");
  } catch (err) {
    console.error("[startup] CarrierProfile schema sync failed:", err);
  }
}
