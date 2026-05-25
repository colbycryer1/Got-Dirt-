import { NextRequest, NextResponse } from "next/server";
import { getMobileToken, verifyMobileJWT } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createSchema = z.object({
  orderId:      z.string().cuid(),
  materialType: z.string().min(1),
});

function resolveRate(
  materialType: string,
  pit: { dumpRateCents: number | null; borrowRateCents: number | null; topsoilRateCents: number | null; materialRatesCents: unknown },
  orderType: string,
): number | null {
  const perMaterial = (pit.materialRatesCents ?? {}) as Record<string, number>;
  if (typeof perMaterial[materialType] === "number") return perMaterial[materialType];
  const mt = materialType.toLowerCase();
  if (mt.includes("topsoil") || mt.includes("top soil")) {
    return pit.topsoilRateCents ?? (orderType === "DUMP" ? pit.dumpRateCents : pit.borrowRateCents);
  }
  if (orderType === "DUMP") return pit.dumpRateCents ?? pit.borrowRateCents;
  return pit.borrowRateCents ?? pit.dumpRateCents;
}

export async function POST(req: NextRequest) {
  const token = getMobileToken(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let user;
  try { user = await verifyMobileJWT(token); } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { orderId, materialType } = parsed.data;
  const order = await prisma.order.findUnique({
    where:   { id: orderId },
    include: { pit: { select: { id: true, ownerId: true, dumpRateCents: true, borrowRateCents: true, topsoilRateCents: true, materialRatesCents: true } } },
  });

  if (!order || order.status !== "ACTIVE") {
    return NextResponse.json({ error: "Order not found or not active" }, { status: 404 });
  }
  if (order.pit.ownerId !== user.id && user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rateCents = resolveRate(materialType, order.pit, order.orderType);
  if (rateCents === null) {
    return NextResponse.json({ error: "No rate configured for this material" }, { status: 422 });
  }

  const loadEvent = await prisma.loadEvent.create({
    data: {
      orderId,
      pitId:              order.pitId,
      operatorUserId:     user.id,
      verificationMethod: "OPERATOR",
      materialType,
      rateCentsAtTime:    rateCents,
      exitTime:           new Date(),
      manualConfirmed:    true,
      verified:           true,
    },
  });

  return NextResponse.json({ loadEvent }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const token = getMobileToken(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let user;
  try { user = await verifyMobileJWT(token); } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const orderId = req.nextUrl.searchParams.get("orderId");
  if (!orderId) return NextResponse.json({ error: "orderId required" }, { status: 400 });

  const twoMinsAgo = new Date(Date.now() - 2 * 60 * 1000);
  const last = await prisma.loadEvent.findFirst({
    where:   { orderId, operatorUserId: user.id, verificationMethod: "OPERATOR", createdAt: { gte: twoMinsAgo }, disputed: false },
    orderBy: { createdAt: "desc" },
  });

  if (!last) return NextResponse.json({ error: "No undoable entry (2-minute window expired)" }, { status: 404 });

  await prisma.loadEvent.delete({ where: { id: last.id } });
  return NextResponse.json({ deleted: last.id });
}
