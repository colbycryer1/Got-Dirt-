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

  // Allow buyer or hauler to query
  const isAuthorized =
    order.buyerUserId === session.user.id ||
    order.driver?.userId === session.user.id ||
    order.carrier?.userId === session.user.id ||
    session.user.role === "ADMIN";
  if (!isAuthorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!order.pitId) return NextResponse.json({ count: 0, pitName: null });

  const startOfDay = new Date(order.scheduledDate);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const endOfDay = new Date(order.scheduledDate);
  endOfDay.setUTCHours(23, 59, 59, 999);

  const count = await prisma.loadEvent.count({
    where: {
      pitId: order.pitId,
      createdAt: { gte: startOfDay, lte: endOfDay },
    },
  });

  return NextResponse.json({
    count,
    pitName: order.pit?.name ?? null,
    date: order.scheduledDate,
  });
}
