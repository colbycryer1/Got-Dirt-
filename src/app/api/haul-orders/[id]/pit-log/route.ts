import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// POST /api/haul-orders/[id]/pit-log
// Pit owner taps to log one load against a haul order.
// Session must be active for this order.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "PIT_OWNER" && session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const order = await prisma.haulOrder.findUnique({
    where:  { id: params.id },
    select: { pitId: true, pitSessionActive: true },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!order.pitSessionActive)
    return NextResponse.json({ error: "No active session for this order. Start the load log first." }, { status: 409 });

  // Verify pit ownership
  const pit = order.pitId
    ? await prisma.pit.findFirst({ where: { id: order.pitId, ownerId: session.user.id } })
    : null;
  if (!pit) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.pitOwnerLoadLog.create({
    data: { haulOrderId: params.id, pitOwnerUserId: session.user.id },
  });

  const count = await prisma.pitOwnerLoadLog.count({ where: { haulOrderId: params.id } });
  return NextResponse.json({ count });
}

// GET /api/haul-orders/[id]/pit-log — return current pit owner count for this order
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const count = await prisma.pitOwnerLoadLog.count({ where: { haulOrderId: params.id } });
  return NextResponse.json({ count });
}
