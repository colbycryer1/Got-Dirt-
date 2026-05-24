import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

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

  const where: Record<string, unknown> = {};
  if (session.user.role !== "ADMIN") where.buyerUserId = session.user.id;
  if (projectId) where.projectId = projectId;

  const orders = await prisma.order.findMany({
    where: where as Parameters<typeof prisma.order.findMany>[0]["where"],
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
    select: { operatorProvided: true, equipmentProvided: true, equipmentNotes: true },
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

  return NextResponse.json({ order }, { status: 201 });
}
