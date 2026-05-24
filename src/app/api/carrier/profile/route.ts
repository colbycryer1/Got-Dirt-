import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "CARRIER" && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const profile = await prisma.carrierProfile.findUnique({
    where:   { userId: session.user.id },
    include: { terminals: { orderBy: { createdAt: "asc" } } },
  });
  return NextResponse.json({ profile });
}

const patchSchema = z.object({
  companyName:   z.string().max(200).optional(),
  bio:           z.string().max(500).optional(),
  website:       z.string().url().optional().nullable(),
  profilePublic: z.boolean().optional(),
  haulRateCents: z.number().int().min(0).optional(),
});

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "CARRIER" && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const profile = await prisma.carrierProfile.upsert({
    where:   { userId: session.user.id },
    create:  { userId: session.user.id, ...parsed.data },
    update:  parsed.data,
    include: { terminals: true },
  });
  return NextResponse.json({ profile });
}
