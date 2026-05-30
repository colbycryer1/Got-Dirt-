import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { isBuyerRole } from "@/types";
import { z } from "zod";

const editSchema = z.object({
  action:        z.literal("edit"),
  scheduledDate: z.string().datetime().optional(),
  loads:         z.number().int().min(1).optional(),
  notes:         z.string().optional(),
});

const cancelSchema = z.object({
  action: z.literal("cancel").optional(),
});

// PATCH /api/haul-orders/[id] — buyer edits or cancels
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isBuyerRole(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const order = await prisma.haulOrder.findUnique({
    where:  { id: params.id },
    select: {
      id: true, buyerUserId: true, status: true, scheduledDate: true,
      haulRateCents: true, pitMaterialRateCents: true, buyerOperating: true,
    },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (order.buyerUserId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();

  if (body.action === "edit") {
    const parsed = editSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    if (!["PENDING", "CONFIRMED"].includes(order.status)) {
      return NextResponse.json({ error: "Cannot edit this order" }, { status: 409 });
    }
    if (order.scheduledDate < new Date()) {
      return NextResponse.json({ error: "Cannot edit a past order" }, { status: 409 });
    }

    const { scheduledDate, loads, notes } = parsed.data;

    // For CONFIRMED orders, only notes are editable — loads and date require hauler re-confirmation
    if (order.status === "CONFIRMED" && (loads || scheduledDate)) {
      return NextResponse.json({
        error: "Date and load count changes on a confirmed order require a new amendment request.",
      }, { status: 409 });
    }

    const updateData: Record<string, unknown> = {};
    if (scheduledDate) updateData.scheduledDate = new Date(scheduledDate);
    if (loads) {
      const perLoadCents             = order.haulRateCents + order.pitMaterialRateCents;
      updateData.loads               = loads;
      updateData.totalEstimatedCents = loads * perLoadCents;
      // Buyer-op deposit only covers material (truck cost is self-reported, not billed)
      updateData.depositHoldCents    = order.buyerOperating
        ? loads * order.pitMaterialRateCents
        : loads * perLoadCents;
    }
    if (notes !== undefined) updateData.notes = notes || null;

    const updated = await prisma.haulOrder.update({ where: { id: params.id }, data: updateData });
    return NextResponse.json({ order: updated });
  }

  // Default: cancel
  const parsed = cancelSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Unknown action" }, { status: 400 });

  if (!["PENDING", "CONFIRMED"].includes(order.status)) {
    return NextResponse.json({ error: "Cannot cancel this order" }, { status: 409 });
  }

  const updated = await prisma.haulOrder.update({ where: { id: params.id }, data: { status: "CANCELLED" } });
  return NextResponse.json({ order: updated });
}
