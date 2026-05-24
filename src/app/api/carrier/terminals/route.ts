import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const createSchema = z.object({
  name:    z.string().min(1).max(200),
  address: z.string().optional(),
  lat:     z.number(),
  lng:     z.number(),
});

// GET /api/carrier/terminals — list own terminals
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "CARRIER" && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const profile = await prisma.carrierProfile.findUnique({ where: { userId: session.user.id } });
  if (!profile) return NextResponse.json({ terminals: [] });
  const terminals = await prisma.carrierTerminal.findMany({
    where:   { carrierId: profile.id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ terminals });
}

// POST /api/carrier/terminals — add a terminal
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "CARRIER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const profile = await prisma.carrierProfile.upsert({
    where:  { userId: session.user.id },
    create: { userId: session.user.id },
    update: {},
  });
  const terminal = await prisma.carrierTerminal.create({
    data: { carrierId: profile.id, ...parsed.data },
  });
  return NextResponse.json({ terminal }, { status: 201 });
}
