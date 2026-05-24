import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "DRIVER" && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const profile = await prisma.driverProfile.findUnique({ where: { userId: session.user.id } });
  return NextResponse.json({ profile });
}

const patchSchema = z.object({
  bio:              z.string().max(500).optional(),
  profilePublic:    z.boolean().optional(),
  haulRateCents:    z.number().int().min(0).optional(),
  truckType:        z.string().max(100).optional(),
  gdotLicenseUrl:   z.string().url().optional().nullable(),
  insuranceUrl:     z.string().url().optional().nullable(),
  additionalDocUrls: z.array(z.string().url()).optional(),
});

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "DRIVER" && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const profile = await prisma.driverProfile.upsert({
    where:  { userId: session.user.id },
    create: { userId: session.user.id, ...parsed.data },
    update: parsed.data,
  });
  return NextResponse.json({ profile });
}
