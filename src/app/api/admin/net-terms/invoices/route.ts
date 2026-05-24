import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/admin/net-terms/invoices?status=OPEN|OVERDUE|PAID|WRITTEN_OFF
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const status = req.nextUrl.searchParams.get("status");

  const invoices = await prisma.netTermsInvoice.findMany({
    where: status ? { status: status as "OPEN" | "OVERDUE" | "PAID" | "WRITTEN_OFF" } : undefined,
    include: {
      buyer: { select: { id: true, email: true, name: true, company: true } },
      netTermsAccount: { select: { termsDays: true } },
      settlements: { select: { id: true, grossAmountCents: true, verifiedLoadCount: true } },
    },
    orderBy: { dueDate: "asc" },
  });

  return NextResponse.json({ invoices });
}
