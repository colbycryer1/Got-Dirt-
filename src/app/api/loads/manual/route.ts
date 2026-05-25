import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createSchema = z.object({
  orderId:     z.string().cuid(),
  materialType: z.string().min(1),
  notes:       z.string().optional(),
});

// POST — log a manual load (pit operator tap)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { orderId, materialType, notes } = parsed.data;

  // Fetch order with pit to validate and get rate
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      pit: {
        select: {
          id: true,
          ownerId: true,
          dumpRateCents: true,
          borrowRateCents: true,
          topsoilRateCents: true,
          materialRatesCents: true,
          materialTypes: true,
        },
      },
    },
  });

  if (!order || order.status !== "ACTIVE") {
    return NextResponse.json({ error: "Order not found or not active" }, { status: 404 });
  }

  // Operator must own the pit
  if (order.pit.ownerId !== session.user.id && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Resolve rate for this material type
  const rateCents = resolveRate(materialType, order.pit);
  if (rateCents === null) {
    return NextResponse.json({ error: "No rate configured for this material type" }, { status: 422 });
  }

  const loadEvent = await prisma.loadEvent.create({
    data: {
      orderId,
      pitId:              order.pitId,
      operatorUserId:     session.user.id,
      verificationMethod: "OPERATOR",
      materialType,
      rateCentsAtTime:    rateCents,
      exitTime:           new Date(),
      manualConfirmed:    true,
      verified:           true,
      notes:              notes ?? null,
    },
  });

  return NextResponse.json({ loadEvent }, { status: 201 });
}

// DELETE — undo last load within 2-minute window
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get("orderId");
  if (!orderId) return NextResponse.json({ error: "orderId required" }, { status: 400 });

  const twoMinsAgo = new Date(Date.now() - 2 * 60 * 1000);

  const last = await prisma.loadEvent.findFirst({
    where: {
      orderId,
      operatorUserId:     session.user.id,
      verificationMethod: "OPERATOR",
      createdAt:          { gte: twoMinsAgo },
      disputed:           false,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!last) {
    return NextResponse.json({ error: "No undoable entry found (2-minute window expired)" }, { status: 404 });
  }

  await prisma.loadEvent.delete({ where: { id: last.id } });
  return NextResponse.json({ deleted: last.id });
}

function resolveRate(
  materialType: string,
  pit: {
    dumpRateCents: number | null;
    borrowRateCents: number | null;
    topsoilRateCents: number | null;
    materialRatesCents: unknown;
  }
): number | null {
  // 1. Check per-material override first
  const perMaterial = (pit.materialRatesCents ?? {}) as Record<string, number>;
  if (typeof perMaterial[materialType] === "number") return perMaterial[materialType];

  // 2. Topsoil area rate
  const mt = materialType.toLowerCase();
  if (mt.includes("topsoil") || mt.includes("top soil")) {
    return pit.topsoilRateCents ?? pit.dumpRateCents ?? pit.borrowRateCents;
  }

  // 3. Base dump rate, falling back to borrow rate
  return pit.dumpRateCents ?? pit.borrowRateCents;
}
