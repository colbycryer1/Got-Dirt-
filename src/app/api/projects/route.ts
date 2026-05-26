import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createSchema = z.object({
  name:        z.string().min(1),
  location:    z.string().min(1, "Job site address is required"),
  description: z.string().optional(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isBuyer = session.user.role === "BUYER" || session.user.role === "CARRIER" || session.user.role === "CONTRACTOR";
  if (!isBuyer && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const where = session.user.role === "ADMIN" ? {} : { buyerUserId: session.user.id };

  const projects = await prisma.project.findMany({
    where,
    include: {
      _count: { select: { orders: true } },
      orders: {
        where: { status: "ACTIVE" },
        select: { id: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ projects });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isBuyer = session.user.role === "BUYER" || session.user.role === "CARRIER" || session.user.role === "CONTRACTOR";
  if (!isBuyer && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const project = await prisma.project.create({
    data: {
      buyerUserId: session.user.id,
      name:        parsed.data.name,
      location:    parsed.data.location,
      description: parsed.data.description,
    },
  });

  return NextResponse.json({ project }, { status: 201 });
}
