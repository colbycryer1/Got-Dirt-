import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// GET /api/haul-orders/available
// Returns open broadcast FCFS haul orders that drivers/carriers can claim
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  if (role !== "DRIVER" && role !== "CARRIER")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const orders = await prisma.haulOrder.findMany({
    where: {
      driverId:  null,
      carrierId: null,
      status:    "PENDING",
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
    include: {
      buyer:   { select: { name: true, company: true } },
      pit:     { select: { name: true, state: true } },
      project: { select: { name: true } },
    },
    orderBy: { scheduledDate: "asc" },
  });

  return NextResponse.json({ orders });
}
