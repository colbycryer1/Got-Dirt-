import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// GET /api/driver/pending-orders
// Lightweight polling endpoint — returns PENDING haul orders assigned to this driver.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ orders: [] });
  if (session.user.role !== "DRIVER") return NextResponse.json({ orders: [] });

  const profile = await prisma.driverProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!profile) return NextResponse.json({ orders: [] });

  const orders = await prisma.haulOrder.findMany({
    where:   { driverId: profile.id, status: "PENDING" },
    include: {
      buyer:   { select: { name: true, company: true, phone: true } },
      pit:     { select: { name: true, state: true } },
      project: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ orders });
}
