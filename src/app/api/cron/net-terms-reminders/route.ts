import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function isCronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  return req.headers.get("x-cron-secret") === secret;
}

function daysDiff(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / 86_400_000);
}

// POST /api/cron/net-terms-reminders
// Sends overdue reminder emails and escalates to admin at +15 days.
export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const openInvoices = await prisma.netTermsInvoice.findMany({
    where: { status: { in: ["OPEN", "OVERDUE"] } },
    include: {
      buyer: { select: { id: true, email: true, name: true } },
      netTermsAccount: { select: { termsDays: true } },
    },
  });

  const updates: Array<Promise<unknown>> = [];

  for (const inv of openInvoices) {
    const overdueDays = daysDiff(inv.dueDate, today);

    // Mark OVERDUE
    if (overdueDays >= 0 && inv.status === "OPEN") {
      updates.push(
        prisma.netTermsInvoice.update({
          where: { id: inv.id },
          data: { status: "OVERDUE" },
        })
      );
    }

    // Due-date reminder (day 0)
    if (overdueDays === 0 && !inv.reminderSentAt) {
      updates.push(
        prisma.netTermsInvoice.update({
          where: { id: inv.id },
          data: { reminderSentAt: today },
        })
      );
      // fire-and-forget email
      sendReminderEmail(inv.buyer.email, inv.buyer.name, inv, 0).catch(console.error);
    }

    // +3 days
    if (overdueDays >= 3 && !inv.plus3SentAt) {
      updates.push(
        prisma.netTermsInvoice.update({
          where: { id: inv.id },
          data: { plus3SentAt: today },
        })
      );
      sendReminderEmail(inv.buyer.email, inv.buyer.name, inv, 3).catch(console.error);
    }

    // +7 days
    if (overdueDays >= 7 && !inv.plus7SentAt) {
      updates.push(
        prisma.netTermsInvoice.update({
          where: { id: inv.id },
          data: { plus7SentAt: today },
        })
      );
      sendReminderEmail(inv.buyer.email, inv.buyer.name, inv, 7).catch(console.error);
    }

    // +15 days — escalate
    if (overdueDays >= 15 && !inv.plus15SentAt) {
      updates.push(
        prisma.netTermsInvoice.update({
          where: { id: inv.id },
          data: { plus15SentAt: today, escalatedToAdmin: true },
        })
      );
      sendReminderEmail(inv.buyer.email, inv.buyer.name, inv, 15).catch(console.error);
      escalateToAdmin(inv).catch(console.error);
    }
  }

  await Promise.all(updates);
  return NextResponse.json({ processed: openInvoices.length });
}

async function sendReminderEmail(
  email: string,
  name: string | null,
  inv: { invoiceNumber: string; totalDueCents: number; dueDate: Date },
  daysPastDue: number
) {
  const { sendEmail } = await import("@/lib/email");
  const subject =
    daysPastDue === 0
      ? `Invoice ${inv.invoiceNumber} is due today`
      : `Invoice ${inv.invoiceNumber} is ${daysPastDue} days overdue`;

  const dollars = (inv.totalDueCents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });

  await sendEmail({
    to: email,
    subject,
    html: `
      <p>Hi ${name ?? "there"},</p>
      <p>Your Got Dirt invoice <strong>${inv.invoiceNumber}</strong> for <strong>${dollars}</strong>
         was due on <strong>${inv.dueDate.toLocaleDateString()}</strong>.</p>
      ${daysPastDue >= 15 ? "<p><strong>This invoice has been escalated to our collections team.</strong></p>" : ""}
      <p>Please contact us at <a href="mailto:billing@gotdirt.com">billing@gotdirt.com</a> to resolve.</p>
    `,
  });
}

async function escalateToAdmin(inv: { id: string; invoiceNumber: string; totalDueCents: number }) {
  const { sendEmail } = await import("@/lib/email");
  const dollars = (inv.totalDueCents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
  await sendEmail({
    to: process.env.ADMIN_EMAIL ?? "admin@gotdirt.com",
    subject: `[ESCALATED] Net terms invoice ${inv.invoiceNumber} 15+ days overdue`,
    html: `<p>Invoice <strong>${inv.invoiceNumber}</strong> for <strong>${dollars}</strong> is 15+ days overdue. <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/admin/net-terms/invoices">View in admin →</a></p>`,
  });
}
