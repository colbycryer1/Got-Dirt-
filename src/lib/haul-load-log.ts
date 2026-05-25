import { prisma } from "./prisma";

/**
 * For each haul order, count LoadEvents logged by the pit operator at the
 * same pit for the same buyer on the same scheduled date.  This is the
 * authoritative load count — the same Load Log the buyer sees on their
 * pit material Order.
 *
 * Returns a map of haulOrderId → load count (0 if no linked events).
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
