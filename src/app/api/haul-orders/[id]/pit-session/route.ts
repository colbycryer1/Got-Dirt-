import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCobDueAt, isAfterCOB } from "@/lib/timezone";
import { sendOverageApprovalRequest } from "@/lib/email";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

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
      pitId:               true,
      pitSessionStartedAt: true,
      loads:               true,
      haulRateCents:       true,
      pitMaterialRateCents: true,
      buyer: { select: { email: true, name: true } },
    },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Verify pit ownership
  const pit = order.pitId
    ? await prisma.pit.findFirst({
        where:  { id: order.pitId, ownerId: session.user.id },
        select: { state: true, name: true },
      })
    : null;
  if (!pit) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const now = new Date();
  let updateData: Record<string, unknown>;

  if (active) {
    // Starting a session
    updateData = {
      pitSessionActive:    true,
      pitSessionStartedAt: now,
      pitSessionStartedBy: session.user.id,
    };
  } else {
    // Ending a session — compute COB deadline and record actual loads
    const sessionCount = await prisma.pitOwnerLoadLog.count({
      where: {
        haulOrderId: params.id,
        ...(order.pitSessionStartedAt ? { loggedAt: { gte: order.pitSessionStartedAt } } : {}),
      },
    });

    const cobDueAt   = getCobDueAt(pit.state, now);
    const afterHours = isAfterCOB(pit.state, now);
    const settings   = await prisma.platformSettings.findUnique({ where: { id: "singleton" } });
    const afterHoursFeeCents = afterHours ? (settings?.afterHoursFeeCents ?? 500) : 0;

    // Detect overage — pit logged more loads than the buyer ordered
    const overageLoads = sessionCount > order.loads ? sessionCount - order.loads : 0;

    updateData = {
      pitSessionActive:    false,
      pitSessionEndedAt:   now,
      actualLoads:         sessionCount,
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
