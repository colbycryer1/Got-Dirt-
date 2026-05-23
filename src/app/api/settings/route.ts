import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";

export async function GET() {
  let settings = await prisma.platformSettings.findUnique({
    where: { id: "singleton" },
  });

  if (!settings) {
    settings = await prisma.platformSettings.create({
      data: { id: "singleton", feePercent: 8.0 },
    });
  }

  return NextResponse.json({ feePercent: settings.feePercent });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { feePercent } = await req.json();
  if (typeof feePercent !== "number" || feePercent < 0 || feePercent > 50) {
    return NextResponse.json({ error: "feePercent must be 0–50" }, { status: 400 });
  }

  const settings = await prisma.platformSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", feePercent, updatedBy: session.user.id },
    update: { feePercent, updatedBy: session.user.id },
  });

  return NextResponse.json({ feePercent: settings.feePercent });
}
