import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET  /api/admin/net-terms  — list all net terms accounts
// POST /api/admin/net-terms  — assign net terms to a buyer
export async function GET() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const accounts = await prisma.netTermsAccount.findMany({
    include: {
      buyer: { select: { id: true, email: true, name: true, company: true } },
      netTermsInvoices: {
        where: { status: { in: ["OPEN", "OVERDUE"] } },
        select: { id: true, status: true, totalDueCents: true, dueDate: true },
        orderBy: { dueDate: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ accounts });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json() as {
    buyerUserId: string;
    termsDays?: number;
    creditLimitCents?: number | null;
    downPaymentPct?: number;
    billingPeriodDays?: number;
    notes?: string;
  };

  if (!body.buyerUserId)
    return NextResponse.json({ error: "buyerUserId required" }, { status: 400 });

  const account = await prisma.netTermsAccount.upsert({
    where: { buyerUserId: body.buyerUserId },
    create: {
      buyerUserId: body.buyerUserId,
      termsDays: body.termsDays ?? 30,
      creditLimitCents: body.creditLimitCents ?? null,
      downPaymentPct: body.downPaymentPct ?? 0,
      billingPeriodDays: body.billingPeriodDays ?? 30,
      notes: body.notes,
      assignedBy: session.user.id,
    },
    update: {
      termsDays: body.termsDays ?? 30,
      creditLimitCents: body.creditLimitCents ?? null,
      downPaymentPct: body.downPaymentPct ?? 0,
      billingPeriodDays: body.billingPeriodDays ?? 30,
      notes: body.notes,
      assignedBy: session.user.id,
    },
    include: {
      buyer: { select: { id: true, email: true, name: true, company: true } },
    },
  });

  return NextResponse.json({ account }, { status: 201 });
}
