import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { sendNewOrderPitOwner } from "@/lib/email";

const createSchema = z.object({
  projectId:     z.string().cuid(),
  pitId:         z.string().cuid(),
  estimatedLoads: z.number().int().positive().optional(),
  date:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");

  const where: Prisma.OrderWhereInput = {};
  if (session.user.role !== "ADMIN") where.buyerUserId = session.user.id;
  if (projectId) where.projectId = projectId;

  const orders = await prisma.order.findMany({
    where,
    include: {
      pit:     { select: { name: true, address: true, state: true } },
      project: { select: { name: true } },
      _count:  { select: { loadEvents: true } },
      settlements: {
        select: { date: true, verifiedLoadCount: true, grossAmountCents: true, status: true },
        orderBy: { date: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ orders });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isBuyer = session.user.role === "BUYER" || session.user.role === "CONTRACTOR";
  if (!isBuyer && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { projectId, pitId, estimatedLoads, date } = parsed.data;

  // Verify the project belongs to this buyer
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || (session.user.role !== "ADMIN" && project.buyerUserId !== session.user.id)) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const pit = await prisma.pit.findUnique({
    where: { id: pitId },
    select: {
      name: true,
      operatorProvided: true,
      equipmentProvided: true,
      equipmentNotes: true,
      owner: { select: { email: true, name: true } },
    },
  });
  if (!pit) return NextResponse.json({ error: "Pit not found" }, { status: 404 });

  const order = await prisma.order.create({
    data: {
      projectId,
      pitId,
      buyerUserId:      session.user.id,
      estimatedLoads:   estimatedLoads ?? null,
      date:             new Date(date + "T00:00:00Z"),
      // Snapshot from pit
      operatorProvided:  pit.operatorProvided,
      equipmentProvided: pit.equipmentProvided,
      equipmentNotes:    pit.equipmentNotes,
    },
  });

  // Notify pit owner of new order
  if (pit.owner?.email) {
    const buyer = await prisma.user.findUnique({ where: { id: session.user.id }, select: { company: true } });
    void sendNewOrderPitOwner({
      ownerEmail:  pit.owner.email,
      ownerName:   pit.owner.name,
      pitName:     pit.name,
      buyerCompany: buyer?.company ?? null,
      materialType: "TBD",
      date,
    });
  }

  // Tell the client whether a down payment is required so it can prompt accordingly
  const netTermsAccount = await prisma.netTermsAccount.findUnique({
    where: { buyerUserId: session.user.id },
    select: { termsDays: true, downPaymentPct: true },
  });

  return NextResponse.json({
    order,
    netTermsAccount: netTermsAccount ?? null,
  }, { status: 201 });
}
