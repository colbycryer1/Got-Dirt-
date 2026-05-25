import { NextRequest, NextResponse } from "next/server";
import { getMobileToken, verifyMobileJWT } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const token = getMobileToken(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let user;
  try { user = await verifyMobileJWT(token); } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
  if (user.role !== "PIT_OWNER" && user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const today = new Date(); today.setUTCHours(0, 0, 0, 0);

  const pits = await prisma.pit.findMany({
    where:  { ownerId: user.id, status: "ACTIVE" },
    select: { id: true },
  });
  const pitIds = pits.map((p) => p.id);
  if (!pitIds.length) return NextResponse.json({ orders: [] });

  const orders = await prisma.order.findMany({
    where: {
      pitId:  { in: pitIds },
      status: "ACTIVE",
      date:   { gte: today },
    },
    include: {
      pit:   { select: { name: true, materialTypes: true, dumpRateCents: true, borrowRateCents: true, topsoilRateCents: true, materialRatesCents: true } },
      buyer: { select: { name: true, company: true, phone: true } },
      loadEvents: {
        where:   { verified: true, createdAt: { gte: today } },
        select:  { id: true, materialType: true, rateCentsAtTime: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ orders });
}
