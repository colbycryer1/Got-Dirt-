import { prisma } from "@/lib/prisma";

const OVERLAP_WINDOW_MS = 4 * 60 * 60 * 1000; // 4-hour window

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
