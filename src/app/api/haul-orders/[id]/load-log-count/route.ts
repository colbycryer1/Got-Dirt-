import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const order = await prisma.haulOrder.findUnique({
    where:  { id: params.id },
    select: {
      buyerUserId:         true,
      pitId:               true,
      scheduledDate:       true,
      pitSessionStartedAt: true,
      pitSessionEndedAt:   true,
      actualLoads:         true,
      pit:     { select: { name: true } },
      driver:  { select: { userId: true } },
      carrier: { select: { userId: true } },
    },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAuthorized =
    order.buyerUserId     === session.user.id ||
    order.driver?.userId  === session.user.id ||
    order.carrier?.userId === session.user.id ||
    session.user.role     === "ADMIN";
  if (!isAuthorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const pitName = order.pit?.name ?? null;

  // ── 1. Session ended — actualLoads is the authoritative pit owner count ───
  if (order.pitSessionEndedAt && order.actualLoads != null) {
    return NextResponse.json({ count: order.actualLoads, pitName, source: "pit-session-final" });
  }

  // ── 2. Session started but not yet ended — count live PitOwnerLoadLog taps ─
  if (order.pitId && order.pitSessionStartedAt) {
    const count = await prisma.pitOwnerLoadLog.count({
      where: {
        haulOrderId: params.id,
        loggedAt:    { gte: order.pitSessionStartedAt },
      },
    });
    return NextResponse.json({ count, pitName, source: "pit-log-live" });
  }

  // ── 3. No pit session at all — return 0 so buyer enters manually ──────────
  if (!order.pitId) {
    return NextResponse.json({ count: 0, pitName: null, source: "no-pit" });
  }

  // ── 4. Legacy fallback: LoadEvent from old pit material Order system ───────
  const scheduledDateOnly = order.scheduledDate.toISOString().slice(0, 10);

  const relatedOrders = await prisma.order.findMany({
    where: {
      pitId:       order.pitId,
      buyerUserId: order.buyerUserId,
      date:        new Date(scheduledDateOnly),
    },
    select: { id: true },
  });

  let count = 0;
  if (relatedOrders.length > 0) {
    count = await prisma.loadEvent.count({
      where: { orderId: { in: relatedOrders.map((o) => o.id) } },
    });
  }

  if (count === 0) {
    const startOfDay = new Date(scheduledDateOnly + "T00:00:00.000Z");
    const endOfDay   = new Date(scheduledDateOnly + "T23:59:59.999Z");
    count = await prisma.loadEvent.count({
      where: { pitId: order.pitId, createdAt: { gte: startOfDay, lte: endOfDay } },
    });
  }

  return NextResponse.json({ count, pitName, source: "legacy-load-events" });
}
