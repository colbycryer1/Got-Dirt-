import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

// Called by Vercel Cron at COB daily (vercel.json schedule: "0 23 * * *" = 11PM UTC)
// Vercel sends: Authorization: Bearer CRON_SECRET
function isCronAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${process.env.CRON_SECRET}`) return true;
  // Also accept x-cron-secret for manual triggers
  return req.headers.get("x-cron-secret") === process.env.CRON_SECRET;
}

export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dateParam = req.nextUrl.searchParams.get("date");
  const settleDate = dateParam ? new Date(dateParam + "T00:00:00Z") : todayUTC();

  const results = await runCOBSettlement(settleDate);
  return NextResponse.json({ date: settleDate.toISOString().slice(0, 10), results });
}

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const dateParam = req.nextUrl.searchParams.get("date");
  const settleDate = dateParam ? new Date(dateParam + "T00:00:00Z") : todayUTC();
  const results = await runCOBSettlement(settleDate);
  return NextResponse.json({ date: settleDate.toISOString().slice(0, 10), results });
}

function todayUTC(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

interface SettlementResult {
  orderId: string;
  status: "processed" | "skipped" | "no_loads" | "failed";
  loadCount?: number;
  grossCents?: number;
  error?: string;
}

async function runCOBSettlement(date: Date): Promise<SettlementResult[]> {
  const nextDay = new Date(date.getTime() + 86400000);

  // Find all ACTIVE orders scheduled on or before today
  const activeOrders = await prisma.order.findMany({
    where: {
      status: "ACTIVE",
      date:   { lte: nextDay },
    },
    include: {
      pit:   { select: { id: true, stripeAccountId: true, dumpRateCents: true } },
      buyer: { select: { id: true, stripeCustomerId: true, defaultPaymentMethodId: true } },
    },
  });

  const results: SettlementResult[] = [];
  const feeSettings = await prisma.platformSettings.findUnique({ where: { id: "singleton" } });
  const feePercent = feeSettings?.feePercent ?? 8.0;

  for (const order of activeOrders) {
    // Idempotency: skip if already processed for this date
    const existing = await prisma.settlement.findUnique({
      where: { orderId_date: { orderId: order.id, date } },
    });
    if (existing?.status === "PROCESSED") {
      results.push({ orderId: order.id, status: "skipped" });
      continue;
    }

    // Get verified, non-disputed loads for this order on this date
    const loads = await prisma.loadEvent.findMany({
      where: {
        orderId:  order.id,
        verified: true,
        disputed: false,
        exitTime: {
          gte: date,
          lt:  nextDay,
        },
      },
    });

    if (loads.length === 0) {
      results.push({ orderId: order.id, status: "no_loads" });
      continue;
    }

    // Calculate totals from actual rates snapshotted on each load event
    const grossCents     = loads.reduce((sum, l) => sum + l.rateCentsAtTime, 0);
    const commissionCents = Math.round(grossCents * (feePercent / 100));
    const netToPitCents   = grossCents - commissionCents;

    try {
      let chargeId: string | undefined;
      let transferId: string | undefined;

      const buyer = order.buyer;
      const pit   = order.pit;

      // Only attempt Stripe charge if pit has a connected account and buyer has payment method
      if (pit.stripeAccountId && buyer.stripeCustomerId && buyer.defaultPaymentMethodId) {
        const idempotencyKey = `cob-${order.id}-${date.toISOString().slice(0, 10)}`;

        const paymentIntent = await stripe.paymentIntents.create({
          amount:                 grossCents,
          currency:               "usd",
          customer:               buyer.stripeCustomerId,
          payment_method:         buyer.defaultPaymentMethodId,
          confirm:                true,
          off_session:            true,
          application_fee_amount: commissionCents,
          transfer_data:          { destination: pit.stripeAccountId },
          description:            `Got Dirt? — COB settlement ${date.toISOString().slice(0, 10)} — Order ${order.id}`,
          metadata:               { order_id: order.id, load_count: String(loads.length) },
        }, { idempotencyKey });

        chargeId   = paymentIntent.id;
        transferId = typeof paymentIntent.transfer_data?.destination === "string"
          ? paymentIntent.transfer_data.destination
          : undefined;
      }

      // Upsert settlement record
      await prisma.settlement.upsert({
        where:  { orderId_date: { orderId: order.id, date } },
        create: {
          orderId:           order.id,
          date,
          verifiedLoadCount: loads.length,
          grossAmountCents:  grossCents,
          commissionCents,
          netToPitCents,
          stripeChargeId:    chargeId,
          stripeTransferId:  transferId,
          status:            chargeId ? "PROCESSED" : "PENDING",
        },
        update: {
          verifiedLoadCount: loads.length,
          grossAmountCents:  grossCents,
          commissionCents,
          netToPitCents,
          stripeChargeId:    chargeId,
          stripeTransferId:  transferId,
          status:            chargeId ? "PROCESSED" : "PENDING",
        },
      });

      results.push({
        orderId:    order.id,
        status:     "processed",
        loadCount:  loads.length,
        grossCents,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await prisma.settlement.upsert({
        where:  { orderId_date: { orderId: order.id, date } },
        create: {
          orderId:           order.id,
          date,
          verifiedLoadCount: loads.length,
          grossAmountCents:  grossCents,
          commissionCents,
          netToPitCents,
          status:            "FAILED",
        },
        update: { status: "FAILED" },
      });
      results.push({ orderId: order.id, status: "failed", error: msg });
    }
  }

  return results;
}
