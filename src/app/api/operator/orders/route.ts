import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Pit operators are PIT_OWNER users — fetch orders for their pits
  const userId = session.user.id;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const pits = await prisma.pit.findMany({
    where: { ownerId: userId, status: "ACTIVE" },
    select: { id: true, name: true, materialTypes: true, dumpRateCents: true, borrowRateCents: true, topsoilRateCents: true },
  });

  if (!pits.length) return NextResponse.json({ orders: [] });

  const pitIds = pits.map((p) => p.id);

  const orders = await prisma.order.findMany({
    where: {
      pitId: { in: pitIds },
      status: "ACTIVE",
      date: { gte: today },
    },
    include: {
      pit: { select: { name: true, materialTypes: true, dumpRateCents: true, borrowRateCents: true, topsoilRateCents: true, materialRatesCents: true } },
      buyer: { select: { name: true, company: true, phone: true } },
      loadEvents: {
        where: { verified: true, createdAt: { gte: today } },
        select: { id: true, materialType: true, createdAt: true, rateCentsAtTime: true },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ orders });
}
