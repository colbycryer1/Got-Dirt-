import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// GET /api/pits/[id]/on-site-drivers — returns drivers currently within geofence
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "PIT_OWNER" && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const pit = await prisma.pit.findFirst({
    where:  { id: params.id, ownerId: session.user.id },
    select: { id: true, latitude: true, longitude: true, geofenceRadiusMeters: true },
  });

  if (!pit && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Not found or forbidden" }, { status: 404 });
  }

  // For ADMIN, fetch the pit without ownership check
  const pitData = pit ?? await prisma.pit.findUnique({
    where:  { id: params.id },
    select: { id: true, latitude: true, longitude: true, geofenceRadiusMeters: true },
  });
  if (!pitData) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const orders = await prisma.haulOrder.findMany({
    where: {
      pitId:    pitData.id,
      status:   { in: ["CONFIRMED", "ACTIVE"] },
      driverId: { not: null },
    },
    include: {
      driver: {
        select: {
          id:                  true,
          currentLat:          true,
          currentLng:          true,
          lastLocationAt:      true,
          liveLocationEnabled: true,
          user:                { select: { name: true } },
        },
      },
    },
  });

  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);

  const onSite: Array<{
    orderId:         string;
    driverProfileId: string;
    driverName:      string;
    distanceMeters:  number;
  }> = [];

  for (const order of orders) {
    const driver = order.driver;
    if (!driver) continue;
    if (!driver.liveLocationEnabled) continue;
    if (driver.currentLat == null || driver.currentLng == null) continue;
    if (!driver.lastLocationAt || driver.lastLocationAt < twoMinutesAgo) continue;

    const dist = haversineMeters(
      pitData.latitude,
      pitData.longitude,
      driver.currentLat,
      driver.currentLng,
    );

    if (dist <= pitData.geofenceRadiusMeters) {
      onSite.push({
        orderId:         order.id,
        driverProfileId: driver.id,
        driverName:      driver.user.name ?? "Driver",
        distanceMeters:  Math.round(dist),
      });
    }
  }

  return NextResponse.json({ onSite });
}
