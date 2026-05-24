import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Ctx = { params: { userId: string } };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const account = await prisma.netTermsAccount.findUnique({
    where: { buyerUserId: params.userId },
    include: {
      buyer: { select: { id: true, email: true, name: true, company: true } },
      netTermsInvoices: {
        orderBy: { periodStart: "desc" },
        take: 50,
      },
    },
  });

  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ account });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json() as {
    termsDays?: number;
    creditLimitCents?: number | null;
    downPaymentPct?: number;
    billingPeriodDays?: number;
    notes?: string;
  };

  const account = await prisma.netTermsAccount.update({
    where: { buyerUserId: params.userId },
    data: {
      ...(body.termsDays !== undefined && { termsDays: body.termsDays }),
      ...(body.creditLimitCents !== undefined && { creditLimitCents: body.creditLimitCents }),
      ...(body.downPaymentPct !== undefined && { downPaymentPct: body.downPaymentPct }),
      ...(body.billingPeriodDays !== undefined && { billingPeriodDays: body.billingPeriodDays }),
      ...(body.notes !== undefined && { notes: body.notes }),
    },
  });

  return NextResponse.json({ account });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.netTermsAccount.delete({ where: { buyerUserId: params.userId } });
  return NextResponse.json({ ok: true });
}
