import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  resolution: z.enum(["CLEARED", "ESCALATED", "REPORTED"]),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const flag = await prisma.transactionFlag.findUnique({ where: { id: params.id } });
  if (!flag) return NextResponse.json({ error: "Flag not found" }, { status: 404 });

  await prisma.transactionFlag.update({
    where: { id: params.id },
    data: {
      resolution:  parsed.data.resolution,
      reviewedBy:  session.user.id,
      reviewedAt:  new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}
