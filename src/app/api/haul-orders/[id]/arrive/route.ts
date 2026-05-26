import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// POST /api/haul-orders/[id]/arrive
// Driver manually signals they are at the pit — failsafe when GPS/geofence
// does not detect them automatically.  Sets driverManualArrival = true so
// the pit owner sees them as on-site in the session panel.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const order = await prisma.haulOrder.findUnique({
    where:  { id: params.id },
    select: {
      status:    true,
      buyerUserId: true,
      driver:    { select: { userId: true } },
      carrier:   { select: { userId: true } },
    },
  });

  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Only the assigned driver/carrier or admin may mark arrival
  const isAssignedDriver  = order.driver?.userId  === session.user.id;
  const isAssignedCarrier = order.carrier?.userId === session.user.id;
  const isAdmin           = session.user.role === "ADMIN";
  if (!isAssignedDriver && !isAssignedCarrier && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!["CONFIRMED", "ACTIVE"].includes(order.status)) {
    return NextResponse.json(
      { error: "Order must be CONFIRMED or ACTIVE to mark arrival" },
      { status: 409 }
    );
  }

  await prisma.haulOrder.update({
    where: { id: params.id },
    data:  { driverManualArrival: true, driverManualArrivalAt: new Date() },
  });

  return NextResponse.json({ arrived: true });
}

// DELETE /api/haul-orders/[id]/arrive — driver clears their manual arrival flag
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const order = await prisma.haulOrder.findUnique({
    where:  { id: params.id },
    select: {
      driver:  { select: { userId: true } },
      carrier: { select: { userId: true } },
    },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAssignedDriver  = order.driver?.userId  === session.user.id;
  const isAssignedCarrier = order.carrier?.userId === session.user.id;
  if (!isAssignedDriver && !isAssignedCarrier && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.haulOrder.update({
    where: { id: params.id },
    data:  { driverManualArrival: false, driverManualArrivalAt: null },
  });

  return NextResponse.json({ arrived: false });
}
