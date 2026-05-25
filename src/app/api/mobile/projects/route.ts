import { NextRequest, NextResponse } from "next/server";
import { getMobileToken, verifyMobileJWT } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createSchema = z.object({
  name:        z.string().min(1),
  location:    z.string().optional(),
  description: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const token = getMobileToken(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let user;
  try { user = await verifyMobileJWT(token); } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const projects = await prisma.project.findMany({
    where:   user.role === "ADMIN" ? {} : { buyerUserId: user.id },
    include: { _count: { select: { orders: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ projects });
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

  const project = await prisma.project.create({
    data: { buyerUserId: user.id, ...parsed.data },
  });

  return NextResponse.json({ project }, { status: 201 });
}
