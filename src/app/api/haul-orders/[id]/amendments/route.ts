import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isBuyerRole } from "@/types";
import { NextResponse } from "next/server";
import { z } from "zod";

const createSchema = z.object({
  requestedLoads: z.number().int().min(1),
  reason: z.string().optional(),
});

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const order = await prisma.haulOrder.findUnique({
    where: { id: params.id },
    select: {
      buyerUserId: true,
      driver: { select: { userId: true } },
      carrier: { select: { userId: true } },
      pit: { select: { ownerId: true } },
    },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAuthorized =
    order.buyerUserId === session.user.id ||
    order.driver?.userId === session.user.id ||
    order.carrier?.userId === session.user.id ||
    order.pit?.ownerId === session.user.id ||
    session.user.role === "ADMIN";
  if (!isAuthorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const amendments = await prisma.haulOrderAmendment.findMany({
    where: { haulOrderId: params.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ amendments });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isBuyerRole(session.user.role) && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { requestedLoads, reason } = parsed.data;

  const order = await prisma.haulOrder.findUnique({
    where: { id: params.id },
    include: {
      pit: { select: { name: true, ownerId: true } },
      driver: { select: { userId: true } },
      carrier: { select: { userId: true } },
      amendments: { where: { status: "PENDING" } },
    },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (order.buyerUserId !== session.user.id && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (order.status !== "CONFIRMED" && order.status !== "ACTIVE") {
    return NextResponse.json({ error: "Order cannot be amended in its current state" }, { status: 409 });
  }
  if (requestedLoads <= order.loads) {
    return NextResponse.json({ error: "Amendment is only needed for extra loads. For fewer loads, mark complete directly." }, { status: 400 });
  }
  if (order.amendments.length > 0) {
    return NextResponse.json({ error: "An amendment request is already pending" }, { status: 409 });
  }

  // 24h check — processing fee applies within 24h
  const hoursSincePlaced = (Date.now() - order.createdAt.getTime()) / 1000 / 3600;
  const settings = await prisma.platformSettings.findUnique({ where: { id: "singleton" } });
  const processingFeeCents = hoursSincePlaced < 24 ? (settings?.earlyEditFeeCents ?? 1000) : 0;

  // Determine if pit owner response is needed
  const pitOwnerUserId = order.pit?.ownerId ?? null;
  // If no pit or pit has no owner, pit owner approval not required → pre-set to true
  const pitOwnerApproved = pitOwnerUserId ? null : true;

  const amendment = await prisma.haulOrderAmendment.create({
    data: {
      haulOrderId:       params.id,
      requestedByUserId: session.user.id,
      originalLoads:     order.loads,
      requestedLoads,
      reason:            reason ?? null,
      status:            "PENDING",
      haulerApproved:    null,
      pitOwnerApproved,
      processingFeeCents,
    },
  });

  return NextResponse.json({ amendment }, { status: 201 });
}
