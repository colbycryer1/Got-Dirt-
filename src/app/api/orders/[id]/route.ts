import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OrderStatus } from "@prisma/client";

type Ctx = { params: { id: string } };

// PATCH /api/orders/[id]  { status: "COMPLETED" | "CANCELLED" }
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { status } = await req.json() as { status: string };
  if (status !== "COMPLETED" && status !== "CANCELLED") {
    return NextResponse.json({ error: "status must be COMPLETED or CANCELLED" }, { status: 400 });
  }

  const order = await prisma.order.findUnique({ where: { id: params.id } });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const isOwner = order.buyerUserId === session.user.id;
  const isAdmin = session.user.role === "ADMIN";
  if (!isOwner && !isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (order.status !== OrderStatus.ACTIVE) {
    return NextResponse.json({ error: "Only active orders can be closed out" }, { status: 409 });
  }

  const updated = await prisma.order.update({
    where: { id: params.id },
    data:  { status: status as OrderStatus },
  });

  return NextResponse.json({ order: updated });
}
