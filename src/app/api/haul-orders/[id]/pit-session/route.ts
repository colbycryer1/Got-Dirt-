import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCobDueAt, isAfterCOB } from "@/lib/timezone";
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
      pit: {
        select: { latitude: true, longitude: true, geofenceRadiusMeters: true },
      },
    },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Only count logs from the current session so stale entries from old sessions are excluded
  const count = await prisma.pitOwnerLoadLog.count({
    where: {
      haulOrderId: params.id,
      ...(order.pitSessionStartedAt ? { loggedAt: { gte: order.pitSessionStartedAt } } : {}),
    },
  });

  return NextResponse.json({
    active:         order.pitSessionActive,
    pitLat:         order.pit?.latitude ?? null,
    pitLng:         order.pit?.longitude ?? null,
    geofenceMeters: order.pit?.geofenceRadiusMeters ?? 200,
    pitOwnerCount:  count,
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
    select: { pitId: true, pitSessionStartedAt: true },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Verify pit ownership
  const pit = order.pitId
    ? await prisma.pit.findFirst({
        where:  { id: order.pitId, ownerId: session.user.id },
        select: { state: true },
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

    updateData = {
      pitSessionActive:    false,
      pitSessionEndedAt:   now,
      actualLoads:         sessionCount,
      cobDueAt,
      afterHoursFeeCents,
    };
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
