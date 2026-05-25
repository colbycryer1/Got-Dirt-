import { NextRequest, NextResponse } from "next/server";
import { getMobileToken, verifyMobileJWT } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";
import { OrderType } from "@prisma/client";
import { z } from "zod";

const createSchema = z.object({
  projectId:  z.string().cuid(),
  pitId:      z.string().cuid(),
  orderType:  z.nativeEnum(OrderType).default(OrderType.BORROW),
  date:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function GET(req: NextRequest) {
  const token = getMobileToken(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let user;
  try { user = await verifyMobileJWT(token); } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const orders = await prisma.order.findMany({
    where:   user.role === "ADMIN" ? {} : { buyerUserId: user.id },
    include: {
      pit:     { select: { name: true, address: true, state: true } },
      project: { select: { name: true } },
      _count:  { select: { loadEvents: true } },
      loadEvents: {
        where:  { verified: true },
        select: { id: true, materialType: true, rateCentsAtTime: true, createdAt: true },
      },
      settlements: {
        select: { grossAmountCents: true, verifiedLoadCount: true, status: true },
        orderBy: { date: "desc" },
      },
    },
    orderBy: { date: "desc" },
  });

  return NextResponse.json({ orders });
}

export async function POST(req: NextRequest) {
  const token = getMobileToken(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let user;
  try { user = await verifyMobileJWT(token); } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
  const isBuyer = ["BUYER", "CARRIER", "CONTRACTOR"].includes(user.role);
  if (!isBuyer && user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { projectId, pitId, orderType, date } = parsed.data;

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || (user.role !== "ADMIN" && project.buyerUserId !== user.id)) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const pit = await prisma.pit.findUnique({
    where:  { id: pitId },
    select: { pitType: true, operatorProvided: true, equipmentProvided: true, equipmentNotes: true },
  });
  if (!pit) return NextResponse.json({ error: "Pit not found" }, { status: 404 });

  const isDumpPit   = pit.pitType === "WASTE" || pit.pitType === "WASTE_BORROW";
  const isBorrowPit = pit.pitType !== "WASTE";
  if (orderType === "DUMP" && !isDumpPit)   return NextResponse.json({ error: "This pit does not accept drop-offs." }, { status: 422 });
  if (orderType === "BORROW" && !isBorrowPit) return NextResponse.json({ error: "This pit does not offer material pickup." }, { status: 422 });

  const order = await prisma.order.create({
    data: {
      projectId,
      pitId,
      orderType,
      buyerUserId:      user.id,
      date:             new Date(date + "T00:00:00Z"),
      operatorProvided:  pit.operatorProvided,
      equipmentProvided: pit.equipmentProvided,
      equipmentNotes:    pit.equipmentNotes,
    },
  });

  return NextResponse.json({ order }, { status: 201 });
}
