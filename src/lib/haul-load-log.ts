import { prisma } from "./prisma";

/**
 * Returns pit owner tap counts from PitOwnerLoadLog keyed by haulOrderId.
 * Counts are scoped to the CURRENT session only (loggedAt >= pitSessionStartedAt)
 * so that historical entries from old sessions don't pollute the count, and
 * starting a new session for the next order naturally resets the display to 0.
 */
export async function getPitOwnerLoadLogCounts(
  haulOrderIds: string[]
): Promise<Record<string, number>> {
  if (haulOrderIds.length === 0) return {};

  // Fetch session start times so we can scope counts to the current session
  const orders = await prisma.haulOrder.findMany({
    where:  { id: { in: haulOrderIds } },
    select: { id: true, pitSessionStartedAt: true },
  });

  const sessionStarts: Record<string, Date | null> = {};
  for (const o of orders) sessionStarts[o.id] = o.pitSessionStartedAt;

  // Fetch all relevant logs in one query, then filter in memory
  const logs = await prisma.pitOwnerLoadLog.findMany({
    where:  { haulOrderId: { in: haulOrderIds } },
    select: { haulOrderId: true, loggedAt: true },
  });

  const counts: Record<string, number> = {};
  for (const log of logs) {
    const start = sessionStarts[log.haulOrderId];
    // Only count logs from the current session
    if (!start || log.loggedAt >= start) {
      counts[log.haulOrderId] = (counts[log.haulOrderId] ?? 0) + 1;
    }
  }
  return counts;
}

/**
 * Legacy: counts LoadEvents on pit material Orders bridged via pit+buyer+date.
 * Kept for reference — callers should prefer getPitOwnerLoadLogCounts().
 */
export async function getHaulOrderLoadLogCounts(
  haulOrders: Array<{
    id:            string;
    pitId:         string | null;
    buyerUserId:   string;
    scheduledDate: Date;
  }>
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};

  const withPit = haulOrders.filter((o) => o.pitId);
  if (withPit.length === 0) return counts;

  // Find the buyer's pit material Orders at each pit on the scheduled date
  const pitOrders = await prisma.order.findMany({
    where: {
      OR: withPit.map((o) => ({
        pitId:       o.pitId!,
        buyerUserId: o.buyerUserId,
        date:        new Date(o.scheduledDate.toISOString().slice(0, 10)),
      })),
    },
    select: { id: true, pitId: true, buyerUserId: true, date: true },
  });

  if (pitOrders.length === 0) return counts;

  // Count load events for those pit orders in one query
  const loadGroups = await prisma.loadEvent.groupBy({
    by:    ["orderId"],
    where: { orderId: { in: pitOrders.map((o) => o.id) } },
    _count: { id: true },
  });

  const byPitOrderId: Record<string, number> = {};
  for (const g of loadGroups) {
    byPitOrderId[g.orderId] = g._count.id;
  }

  // Map counts back to their haul orders
  for (const haulOrder of withPit) {
    const dateStr  = haulOrder.scheduledDate.toISOString().slice(0, 10);
    const matching = pitOrders.filter(
      (po) =>
        po.pitId       === haulOrder.pitId &&
        po.buyerUserId === haulOrder.buyerUserId &&
        po.date.toISOString().slice(0, 10) === dateStr
    );
    counts[haulOrder.id] = matching.reduce(
      (sum, po) => sum + (byPitOrderId[po.id] ?? 0),
      0
    );
  }

  return counts;
}
