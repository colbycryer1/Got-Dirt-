import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";

export async function GET() {
  let settings = await prisma.platformSettings.findUnique({ where: { id: "singleton" } });
  if (!settings) {
    settings = await prisma.platformSettings.create({
      data: { id: "singleton", feePercent: 8.0, haulFeePercent: 10.0 },
    });
  }
  return NextResponse.json({ feePercent: settings.feePercent, haulFeePercent: settings.haulFeePercent });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json() as { feePercent?: number; haulFeePercent?: number };
  const updates: { feePercent?: number; haulFeePercent?: number; updatedBy: string } = { updatedBy: session.user.id };

  if (body.feePercent !== undefined) {
    if (typeof body.feePercent !== "number" || body.feePercent < 0 || body.feePercent > 50)
      return NextResponse.json({ error: "feePercent must be 0–50" }, { status: 400 });
    updates.feePercent = body.feePercent;
  }
  if (body.haulFeePercent !== undefined) {
    if (typeof body.haulFeePercent !== "number" || body.haulFeePercent < 0 || body.haulFeePercent > 50)
      return NextResponse.json({ error: "haulFeePercent must be 0–50" }, { status: 400 });
    updates.haulFeePercent = body.haulFeePercent;
  }

  const settings = await prisma.platformSettings.upsert({
    where:  { id: "singleton" },
    create: { id: "singleton", feePercent: 8.0, haulFeePercent: 10.0, ...updates },
    update: updates,
  });

  return NextResponse.json({ feePercent: settings.feePercent, haulFeePercent: settings.haulFeePercent });
}
