import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R    = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a    = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// GET /api/operator/haul-sessions
// Returns haul orders at this pit owner's pits that have a driver on-site
// (GPS or manual) or an active load session.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "PIT_OWNER" && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const pits = await prisma.pit.findMany({
    where:  { ownerId: session.user.id },
    select: { id: true, name: true, state: true, latitude: true, longitude: true, geofenceRadiusMeters: true },
  });
  if (pits.length === 0) return NextResponse.json({ sessions: [] });

  const pitMap = Object.fromEntries(pits.map((p) => [p.id, p]));

  const orders = await prisma.haulOrder.findMany({
    where: {
      pitId:  { in: pits.map((p) => p.id) },
      status: { in: ["CONFIRMED", "ACTIVE"] },
    },
    select: {
      id:                    true,
      loads:                 true,
      pitId:                 true,
      pitSessionActive:      true,
      pitSessionStartedAt:   true,
      pitSessionEndedAt:     true,
      driverManualArrival:   true,
      driverManualArrivalAt: true,
      buyer:   { select: { name: true, company: true } },
      driver:  {
        select: {
          user:                { select: { name: true } },
          currentLat:          true,
          currentLng:          true,
          lastLocationAt:      true,
          liveLocationEnabled: true,
        },
      },
      carrier: { select: { companyName: true, user: { select: { name: true } } } },
      pitOwnerLoadLogs: {
        select: { loggedAt: true },
        orderBy: { loggedAt: "asc" },
      },
    },
  });

  // Driver load counts in one batch query
  const driverCounts = await prisma.driverLoadLog.groupBy({
    by:    ["haulOrderId"],
    where: { haulOrderId: { in: orders.map((o) => o.id) } },
    _count: { id: true },
  });
  const driverCountMap = Object.fromEntries(driverCounts.map((d) => [d.haulOrderId, d._count.id]));

  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
  const eightHoursAgo = new Date(Date.now() - 8 * 60 * 60 * 1000);

  const result = [];

  for (const order of orders) {
    if (!order.pitId) continue;
    const pit = pitMap[order.pitId];
    if (!pit) continue;

    let onSite = false;
    let manual = false;

    // GPS geofence check
    const driver = order.driver;
    if (
      driver?.liveLocationEnabled &&
      driver.currentLat != null &&
      driver.currentLng != null &&
      driver.lastLocationAt != null &&
      new Date(driver.lastLocationAt) >= twoMinutesAgo
    ) {
      const dist = haversineMeters(pit.latitude, pit.longitude, driver.currentLat, driver.currentLng);
      if (dist <= pit.geofenceRadiusMeters) onSite = true;
    }

    // Manual arrival fallback
    if (
      !onSite &&
      order.driverManualArrival &&
      order.driverManualArrivalAt &&
      new Date(order.driverManualArrivalAt) >= eightHoursAgo
    ) {
      onSite = true;
      manual = true;
    }

    // Only surface orders where something is happening
    if (!onSite && !order.pitSessionActive) continue;

    // Count only logs from the current session
    const sessionStart = order.pitSessionStartedAt;
    const pitOwnerCount = order.pitOwnerLoadLogs.filter(
      (l) => !sessionStart || new Date(l.loggedAt) >= new Date(sessionStart)
    ).length;

    const haulerName = order.carrier
      ? order.carrier.companyName ?? order.carrier.user.name ?? "Carrier"
      : order.driver?.user.name ?? "Driver";

    result.push({
      orderId:          order.id,
      pitId:            pit.id,
      pitName:          pit.name,
      buyerName:        order.buyer.company ?? order.buyer.name ?? "Buyer",
      haulerName,
      estimatedLoads:   order.loads,
      sessionActive:    order.pitSessionActive,
      sessionCompleted: order.pitSessionEndedAt !== null,
      pitOwnerCount,
      driverCount:      driverCountMap[order.id] ?? 0,
      sessionStartedAt: order.pitSessionStartedAt?.toISOString() ?? null,
      onSite,
      manual,
    });
  }

  return NextResponse.json({ sessions: result });
}
