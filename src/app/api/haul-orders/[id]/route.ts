import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { isBuyerRole } from "@/types";

// PATCH /api/haul-orders/[id] — buyer cancels
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isBuyerRole(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const order = await prisma.haulOrder.findUnique({ where: { id: params.id } });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (order.buyerUserId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!["PENDING", "CONFIRMED"].includes(order.status)) {
    return NextResponse.json({ error: "Cannot cancel this order" }, { status: 409 });
  }

  const updated = await prisma.haulOrder.update({ where: { id: params.id }, data: { status: "CANCELLED" } });
  return NextResponse.json({ order: updated });
}
