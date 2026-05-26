import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCobDueAt, isAfterCOB } from "@/lib/timezone";
import { sendOverageApprovalRequest } from "@/lib/email";
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

// GET /api/haul-orders/[id]/pit-session
// Driver polls to check if the pit owner has started a load session for their order.
// Returns pit coordinates so the driver can check their own geofence position.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const order = await prisma.haulOrder.findUnique({
    where:  { id: params.id },
    select: {
      pitSessionActive:    true,
      pitSessionStartedAt: true,
      pitSessionEndedAt:   true,
      pit: {
        select: { latitude: true, longitude: true, geofenceRadiusMeters: true },
      },
    },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Count logs from the current session only
  const [pitOwnerCount, driverCount] = await Promise.all([
    prisma.pitOwnerLoadLog.count({
      where: {
        haulOrderId: params.id,
        ...(order.pitSessionStartedAt ? { loggedAt: { gte: order.pitSessionStartedAt } } : {}),
      },
    }),
    prisma.driverLoadLog.count({
      where: { haulOrderId: params.id },
    }),
  ]);

  return NextResponse.json({
    active:           order.pitSessionActive,
    sessionCompleted: order.pitSessionEndedAt !== null,
    pitLat:           order.pit?.latitude ?? null,
    pitLng:           order.pit?.longitude ?? null,
    geofenceMeters:   order.pit?.geofenceRadiusMeters ?? 200,
    pitOwnerCount,
    driverCount,
    sessionStartedAt: order.pitSessionStartedAt ?? null,
  });
}

// PATCH /api/haul-orders/[id]/pit-session
// Pit owner starts or stops the load-log session for a haul order at their pit.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "PIT_OWNER" && session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { active } = await req.json() as { active: boolean };

  const order = await prisma.haulOrder.findUnique({
    where:  { id: params.id },
    select: {
      pitId:                 true,
      pitSessionStartedAt:   true,
      loads:                 true,
      haulRateCents:         true,
      pitMaterialRateCents:  true,
      driverManualArrival:   true,
      driverManualArrivalAt: true,
      buyer:  { select: { email: true, name: true } },
      driver: {
        select: {
          currentLat:          true,
          currentLng:          true,
          lastLocationAt:      true,
          liveLocationEnabled: true,
        },
      },
    },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Verify pit ownership
  const pit = order.pitId
    ? await prisma.pit.findFirst({
        where:  { id: order.pitId, ownerId: session.user.id },
        select: { state: true, name: true, latitude: true, longitude: true, geofenceRadiusMeters: true },
      })
    : null;
  if (!pit) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const now = new Date();
  let updateData: Record<string, unknown>;

  if (active) {
    // Verify hauler is within the geofence or has manually confirmed arrival
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    const eightHoursAgo = new Date(Date.now() - 8 * 60 * 60 * 1000);

    let onSite = false;

    // GPS geofence check — driver with live location enabled and recent ping
    const driver = order.driver;
    if (
      driver?.liveLocationEnabled &&
      driver.currentLat  != null &&
      driver.currentLng  != null &&
      driver.lastLocationAt != null &&
      new Date(driver.lastLocationAt) >= twoMinutesAgo
    ) {
      const dist = haversineMeters(
        pit.latitude, pit.longitude,
        driver.currentLat, driver.currentLng,
      );
      if (dist <= (pit.geofenceRadiusMeters ?? 200)) onSite = true;
    }

    // Manual arrival fallback — driver tapped "I've Arrived" within 8 hours
    if (
      !onSite &&
      order.driverManualArrival &&
      order.driverManualArrivalAt &&
      new Date(order.driverManualArrivalAt) >= eightHoursAgo
    ) {
      onSite = true;
    }

    if (!onSite) {
      return NextResponse.json(
        { error: "Cannot start session — the hauler is not within the pit geofence. The driver must arrive on-site (GPS or manual arrival) before you can begin logging loads." },
        { status: 409 },
      );
    }

    updateData = {
      pitSessionActive:    true,
      pitSessionStartedAt: now,
      pitSessionStartedBy: session.user.id,
    };
  } else {
    // Ending a session — record both pit owner and driver counts, compute COB deadline
    const [sessionCount, driverSessionCount] = await Promise.all([
      prisma.pitOwnerLoadLog.count({
        where: {
          haulOrderId: params.id,
          ...(order.pitSessionStartedAt ? { loggedAt: { gte: order.pitSessionStartedAt } } : {}),
        },
      }),
      prisma.driverLoadLog.count({
        where: {
          haulOrderId: params.id,
          ...(order.pitSessionStartedAt ? { loggedAt: { gte: order.pitSessionStartedAt } } : {}),
        },
      }),
    ]);

    const cobDueAt   = getCobDueAt(pit.state, now);
    const afterHours = isAfterCOB(pit.state, now);
    const settings   = await prisma.platformSettings.findUnique({ where: { id: "singleton" } });
    const afterHoursFeeCents = afterHours ? (settings?.afterHoursFeeCents ?? 500) : 0;

    // Detect overage — pit logged more loads than the buyer ordered
    const overageLoads = sessionCount > order.loads ? sessionCount - order.loads : 0;

    updateData = {
      pitSessionActive:    false,
      pitSessionEndedAt:   now,
      actualLoads:         sessionCount,       // pit owner count — authoritative for billing
      driverActualLoads:   driverSessionCount, // driver GPS count — stored for transparency
      cobDueAt,
      afterHoursFeeCents,
      ...(overageLoads > 0 ? {
        overageLoads,
        overagePendingAt: now,
        // overageApproved stays null — awaiting buyer decision
      } : {}),
    };

    // Notify buyer about overage so they can approve before COB
    if (overageLoads > 0 && order.buyer.email) {
      const cobTimeStr = cobDueAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      const perLoadCents = order.haulRateCents + (order.pitMaterialRateCents ?? 0);
      sendOverageApprovalRequest({
        buyerEmail:   order.buyer.email,
        buyerName:    order.buyer.name,
        pitName:      pit.name ?? pit.state,
        orderedLoads: order.loads,
        actualLoads:  sessionCount,
        overageLoads,
        rateCents:    perLoadCents,
        cobTimeStr,
        orderId:      params.id,
      }).catch(console.error);
    }
  }

  const updated = await prisma.haulOrder.update({
    where:  { id: params.id },
    data:   updateData,
    select: { pitSessionActive: true, cobDueAt: true, afterHoursFeeCents: true },
  });

  return NextResponse.json({
    active:              updated.pitSessionActive,
    cobDueAt:            updated.cobDueAt ?? null,
    afterHoursFeeCents:  updated.afterHoursFeeCents,
  });
}
