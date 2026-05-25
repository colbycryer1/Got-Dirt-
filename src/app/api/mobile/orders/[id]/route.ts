import { NextRequest, NextResponse } from "next/server";
import { getMobileToken, verifyMobileJWT } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const token = getMobileToken(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let user;
  try { user = await verifyMobileJWT(token); } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const order = await prisma.order.findUnique({ where: { id: params.id } });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (order.buyerUserId !== user.id && user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (order.status !== "ACTIVE") {
    return NextResponse.json({ error: "Only active orders can be closed" }, { status: 409 });
  }

  const { status } = await req.json() as { status: string };
  if (status !== "COMPLETED" && status !== "CANCELLED") {
    return NextResponse.json({ error: "status must be COMPLETED or CANCELLED" }, { status: 400 });
  }

  const updated = await prisma.order.update({
    where: { id: params.id },
    data:  { status: status as "COMPLETED" | "CANCELLED" },
  });

  return NextResponse.json({ order: updated });
}
