import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const order = await prisma.haulOrder.findUnique({
    where: { id: params.id },
    select: {
      buyerUserId: true,
      pitId: true,
      scheduledDate: true,
      pit: { select: { name: true } },
      driver: { select: { userId: true } },
      carrier: { select: { userId: true } },
    },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAuthorized =
    order.buyerUserId === session.user.id ||
    order.driver?.userId === session.user.id ||
    order.carrier?.userId === session.user.id ||
    session.user.role === "ADMIN";
  if (!isAuthorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!order.pitId) return NextResponse.json({ count: 0, pitName: null });

  // Primary: find the buyer's pit material Orders at this pit on the scheduled date,
  // then count their LoadEvents. This matches the same Load Log the buyer sees.
  const scheduledDateOnly = order.scheduledDate.toISOString().slice(0, 10); // YYYY-MM-DD

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
    const orderIds = relatedOrders.map((o) => o.id);
    count = await prisma.loadEvent.count({
      where: { orderId: { in: orderIds } },
    });
  }

  // Fallback: if no linked Orders exist, count all LoadEvents at the pit on that calendar day
  if (count === 0) {
    const startOfDay = new Date(scheduledDateOnly + "T00:00:00.000Z");
    const endOfDay   = new Date(scheduledDateOnly + "T23:59:59.999Z");
    count = await prisma.loadEvent.count({
      where: {
        pitId:     order.pitId,
        createdAt: { gte: startOfDay, lte: endOfDay },
      },
    });
  }

  return NextResponse.json({
    count,
    pitName: order.pit?.name ?? null,
    date:    order.scheduledDate,
  });
}
