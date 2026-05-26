import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const logSchema = z.object({
  haulOrderId: z.string(),
  lat:         z.number().optional(),
  lng:         z.number().optional(),
  speed:       z.number().optional(), // m/s from GPS
});

// POST /api/driver/load-log — driver taps to log a load on their own GPS-verified count
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "DRIVER" && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = logSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { haulOrderId, lat, lng, speed } = parsed.data;

  // Verify driver profile exists and is assigned to this order
  const profile = await prisma.driverProfile.findUnique({
    where:  { userId: session.user.id },
    select: { id: true },
  });
  if (!profile) return NextResponse.json({ error: "Driver profile not found" }, { status: 404 });

  // Verify the haul order belongs to this driver and is active/confirmed
  const order = await prisma.haulOrder.findUnique({
    where:  { id: haulOrderId },
    select: { id: true, driverId: true, status: true, pitId: true },
  });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.driverId !== profile.id) {
    return NextResponse.json({ error: "Not your order" }, { status: 403 });
  }
  if (!["CONFIRMED", "ACTIVE"].includes(order.status)) {
    return NextResponse.json({ error: "Order is not active" }, { status: 409 });
  }

  // Create the driver load log entry
  await prisma.driverLoadLog.create({
    data: {
      haulOrderId,
      driverUserId: session.user.id,
      lat,
      lng,
      speed,
    },
  });

  // Return updated count for this order
  const count = await prisma.driverLoadLog.count({ where: { haulOrderId } });
  return NextResponse.json({ count }, { status: 201 });
}

// GET /api/driver/load-log?haulOrderId=xxx — get driver's own log count
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const haulOrderId = searchParams.get("haulOrderId");
  if (!haulOrderId) return NextResponse.json({ error: "haulOrderId required" }, { status: 400 });

  const count = await prisma.driverLoadLog.count({
    where: { haulOrderId, driverUserId: session.user.id },
  });

  return NextResponse.json({ count });
}
