import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isBuyerRole } from "@/types";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  approved: z.boolean(),
});

// PATCH /api/haul-orders/[id]/overage
// Buyer approves or disputes a pit-owner-initiated load overage.
// Approved  → charge will cover actualLoads at COB (pit owner's authoritative count).
// Disputed  → actualLoads reverts to original order.loads; buyer charged for original count only.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isBuyerRole(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const order = await prisma.haulOrder.findUnique({
    where:  { id: params.id },
    select: {
      id:              true,
      buyerUserId:     true,
      loads:           true,          // original estimated loads
      overageLoads:    true,
      overagePendingAt: true,
      overageApproved: true,
      status:          true,
    },
  });

  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (order.buyerUserId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!order.overagePendingAt) return NextResponse.json({ error: "No overage pending on this order" }, { status: 409 });
  if (order.overageApproved !== null) return NextResponse.json({ error: "Overage already resolved" }, { status: 409 });

  const { approved } = parsed.data;

  const updated = await prisma.haulOrder.update({
    where: { id: params.id },
    data:  {
      overageApproved: approved,
      // If buyer disputes, revert actualLoads to original order count so COB charges correctly
      ...(!approved ? { actualLoads: order.loads } : {}),
    },
    select: {
      id: true, overageApproved: true, actualLoads: true, overageLoads: true, loads: true,
    },
  });

  return NextResponse.json({
    overageApproved: updated.overageApproved,
    actualLoads:     updated.actualLoads,
    message: approved
      ? `Overage approved — you will be charged for all ${updated.actualLoads} loads at COB.`
      : `Overage disputed — you will be charged for the original ${updated.loads} loads only.`,
  });
}
