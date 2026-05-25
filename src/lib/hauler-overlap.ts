import { prisma } from "@/lib/prisma";

const OVERLAP_WINDOW_MS = 4 * 60 * 60 * 1000; // 4-hour window

/**
 * Bulk filter: given a list of hauler profile IDs, returns only those who are
 * available (no conflicting CONFIRMED/ACTIVE order within the ±4-hour window).
 * Same-buyer and same-project orders are never treated as conflicts.
 */
export async function filterAvailableHaulers(
  haulerType:       "driver" | "carrier",
  haulerIds:        string[],
  scheduledDate:    Date,
  newOrderBuyerId:  string,
  newOrderProjectId: string | null
): Promise<string[]> {
  if (haulerIds.length === 0) return [];

  const start    = new Date(scheduledDate.getTime() - OVERLAP_WINDOW_MS);
  const end      = new Date(scheduledDate.getTime() + OVERLAP_WINDOW_MS);
  const idField  = haulerType === "driver" ? "driverId" : "carrierId";

  const whereHauler = haulerType === "driver"
    ? { driverId: { in: haulerIds } }
    : { carrierId: { in: haulerIds } };

  const conflicted = await prisma.haulOrder.findMany({
    where: {
      ...whereHauler,
      status:        { in: ["CONFIRMED", "ACTIVE"] },
      scheduledDate: { gte: start, lte: end },
      buyerUserId:   { not: newOrderBuyerId },
      ...(newOrderProjectId ? { NOT: { projectId: newOrderProjectId } } : {}),
    },
    select: { driverId: true, carrierId: true },
  });

  const conflictedIds = new Set(
    conflicted.map((c) => (haulerType === "driver" ? c.driverId : c.carrierId) as string)
  );
  return haulerIds.filter((id) => !conflictedIds.has(id));
}

/**
 * Returns conflicting confirmed/active orders for a driver or carrier.
 * Exception: orders from the same buyer OR the same project are always allowed
 * (buyer can add more loads to their own jobs without blocking the hauler).
 */
export async function getHaulerConflicts(
  haulerType:      "driver" | "carrier",
  haulerId:        string,
  scheduledDate:   Date,
  newOrderBuyerId: string,
  newOrderProjectId: string | null
) {
  const start = new Date(scheduledDate.getTime() - OVERLAP_WINDOW_MS);
  const end   = new Date(scheduledDate.getTime() + OVERLAP_WINDOW_MS);

  const where = haulerType === "driver"
    ? { driverId: haulerId }
    : { carrierId: haulerId };

  const candidates = await prisma.haulOrder.findMany({
    where: {
      ...where,
      status:        { in: ["CONFIRMED", "ACTIVE"] },
      scheduledDate: { gte: start, lte: end },
    },
    select: { id: true, buyerUserId: true, projectId: true, scheduledDate: true },
  });

  // Allow same-buyer or same-project overlaps (more loads on an existing job)
  return candidates.filter(
    (c) =>
      c.buyerUserId !== newOrderBuyerId &&
      !(newOrderProjectId && c.projectId === newOrderProjectId)
  );
}
