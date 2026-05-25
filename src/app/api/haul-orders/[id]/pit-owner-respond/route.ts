import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  approved: z.boolean(),
  notes:    z.string().optional(),
});

// PATCH /api/haul-orders/[id]/pit-owner-respond — pit owner accepts or denies a haul order
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "PIT_OWNER" && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const order = await prisma.haulOrder.findUnique({ where: { id: params.id } });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!order.pitId) return NextResponse.json({ error: "Order has no pit" }, { status: 400 });

  // Verify pit ownership
  const pit = await prisma.pit.findFirst({
    where: { id: order.pitId, ownerId: session.user.id },
  });
  if (!pit && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden — not your pit" }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { approved, notes } = parsed.data;

  const updateData: Record<string, unknown> = {
    pitOwnerApproved:    approved,
    pitOwnerRespondedAt: new Date(),
  };

  if (!approved) {
    updateData.status = "DENIED";
    if (notes !== undefined) updateData.notes = notes;
  }

  const updated = await prisma.haulOrder.update({
    where: { id: params.id },
    data:  updateData,
  });

  return NextResponse.json({ order: updated });
}
