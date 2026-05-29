// Runs once per server cold-start (Vercel lambda init, local dev restart).
// Adds any HaulOrder columns that were committed without a migration file.
// Uses ADD COLUMN IF NOT EXISTS so it is fully idempotent.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { prisma } = await import("@/lib/prisma");
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
    // Non-fatal — log and continue. Columns may already exist or DB may be unreachable.
    console.error("[startup] HaulOrder schema sync failed:", err);
  }
}
