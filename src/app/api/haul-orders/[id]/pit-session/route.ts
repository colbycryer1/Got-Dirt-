import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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
    select: { pitId: true },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Verify pit ownership
  const pit = order.pitId
    ? await prisma.pit.findFirst({ where: { id: order.pitId, ownerId: session.user.id } })
    : null;
  if (!pit) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const updated = await prisma.haulOrder.update({
    where: { id: params.id },
    data:  {
      pitSessionActive:    active,
      pitSessionStartedAt: active ? new Date() : undefined,
      pitSessionStartedBy: active ? session.user.id : undefined,
    },
    select: { pitSessionActive: true },
  });

  return NextResponse.json({ active: updated.pitSessionActive });
}
