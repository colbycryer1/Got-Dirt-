import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function isCronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  return req.headers.get("x-cron-secret") === secret;
}

function nextInvoiceNumber(): string {
  const now = new Date();
  const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}${String(now.getTime()).slice(-6)}`;
  return `GD-NT-${ts}`;
}

// POST /api/cron/net-terms-invoices
// Idempotent — generates one invoice per buyer per billing period end.
// Triggered by vercel.json cron or manual admin call.
export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const accounts = await prisma.netTermsAccount.findMany({
    include: {
      buyer: { select: { id: true, email: true, name: true } },
    },
  });

  const results: Array<{ buyerUserId: string; invoiceNumber?: string; skipped?: boolean; error?: string }> = [];

  for (const account of accounts) {
    try {
      // Determine billing period: last N days
      const periodEnd = new Date(today);
      periodEnd.setDate(periodEnd.getDate() - 1); // yesterday
      const periodStart = new Date(periodEnd);
      periodStart.setDate(periodStart.getDate() - account.billingPeriodDays + 1);

      // Idempotency check
      const existing = await prisma.netTermsInvoice.findUnique({
        where: {
          buyerUserId_periodStart_periodEnd: {
            buyerUserId: account.buyerUserId,
            periodStart,
            periodEnd,
          },
        },
      });
      if (existing) {
        results.push({ buyerUserId: account.buyerUserId, skipped: true });
        continue;
      }

      // Gather settlements in this period not yet invoiced
      const settlements = await prisma.settlement.findMany({
        where: {
          order: { buyerUserId: account.buyerUserId },
          date: { gte: periodStart, lte: periodEnd },
          netTermsInvoiceId: null,
          status: "PROCESSED",
        },
      });

      if (settlements.length === 0) {
        results.push({ buyerUserId: account.buyerUserId, skipped: true });
        continue;
      }

      const subtotalCents = settlements.reduce((s, r) => s + r.grossAmountCents, 0);
      const commissionCents = settlements.reduce((s, r) => s + r.commissionCents, 0);
      const totalDueCents = subtotalCents;

      const dueDate = new Date(periodEnd);
      dueDate.setDate(dueDate.getDate() + account.termsDays);

      const invoiceNumber = nextInvoiceNumber();

      const invoice = await prisma.netTermsInvoice.create({
        data: {
          netTermsAccountId: account.id,
          buyerUserId: account.buyerUserId,
          invoiceNumber,
          periodStart,
          periodEnd,
          dueDate,
          subtotalCents,
          commissionCents,
          totalDueCents,
          status: "OPEN",
        },
      });

      // Link settlements to this invoice
      await prisma.settlement.updateMany({
        where: { id: { in: settlements.map((s) => s.id) } },
        data: { netTermsInvoiceId: invoice.id },
      });

      results.push({ buyerUserId: account.buyerUserId, invoiceNumber });
    } catch (err) {
      results.push({
        buyerUserId: account.buyerUserId,
        error: err instanceof Error ? err.message : "unknown",
      });
    }
  }

  return NextResponse.json({ results });
}
