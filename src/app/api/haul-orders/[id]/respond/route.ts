import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  action: z.enum(["CONFIRM", "DENY"]),
});

// PATCH /api/haul-orders/[id]/respond — driver or carrier accepts/denies
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  if (role !== "DRIVER" && role !== "CARRIER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const order = await prisma.haulOrder.findUnique({
    where:   { id: params.id },
    include: {
      driver:  { select: { userId: true } },
      carrier: { select: { userId: true } },
    },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Verify this driver/carrier owns the order
  const isDriver  = role === "DRIVER"  && order.driver?.userId  === session.user.id;
  const isCarrier = role === "CARRIER" && order.carrier?.userId === session.user.id;
  if (!isDriver && !isCarrier) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (order.status !== "PENDING") {
    return NextResponse.json({ error: "Order is no longer pending" }, { status: 409 });
  }

  // First-come-first-served expiry check
  if (order.expiresAt && order.expiresAt < new Date()) {
    return NextResponse.json({ error: "This order has expired" }, { status: 410 });
  }

  const updated = await prisma.haulOrder.update({
    where: { id: params.id },
    data:  { status: parsed.data.action === "CONFIRM" ? "CONFIRMED" : "DENIED" },
  });
  return NextResponse.json({ order: updated });
}
