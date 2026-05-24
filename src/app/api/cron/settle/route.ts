import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { sendCOBSettledBuyer, sendPayoutSentPitOwner } from "@/lib/email";

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
      pit:   { select: { id: true, name: true, dumpRateCents: true, owner: { select: { stripeAccountId: true, email: true, name: true } } } },
      buyer: { select: { id: true, email: true, name: true, stripeCustomerId: true, defaultPaymentMethodId: true } },
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

      // Only attempt Stripe charge if pit owner has a connected account and buyer has payment method
      const pitStripeAccountId = pit.owner?.stripeAccountId ?? null;
      if (pitStripeAccountId && buyer.stripeCustomerId && buyer.defaultPaymentMethodId) {
        const idempotencyKey = `cob-${order.id}-${date.toISOString().slice(0, 10)}`;

        const paymentIntent = await stripe.paymentIntents.create({
          amount:                 grossCents,
          currency:               "usd",
          customer:               buyer.stripeCustomerId,
          payment_method:         buyer.defaultPaymentMethodId,
          confirm:                true,
          off_session:            true,
          application_fee_amount: commissionCents,
          transfer_data:          { destination: pitStripeAccountId },
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

      // AML monitoring — fire-and-forget
      const settlement = await prisma.settlement.findUnique({
        where: { orderId_date: { orderId: order.id, date } },
      });
      if (settlement) void runAMLChecks(settlement.id, loads.length, grossCents, order.pit.id, order.buyerUserId, date);

      const dateStr = date.toISOString().slice(0, 10);
      // Fire-and-forget emails
      void sendCOBSettledBuyer({
        buyerEmail: order.buyer.email,
        buyerName:  order.buyer.name,
        pitName:    order.pit.name,
        date:       dateStr,
        loadCount:  loads.length,
        grossCents,
      });
      if (chargeId && order.pit.owner?.email) {
        void sendPayoutSentPitOwner({
          ownerEmail: order.pit.owner.email,
          ownerName:  order.pit.owner.name,
          pitName:    order.pit.name,
          date:       dateStr,
          loadCount:  loads.length,
          netCents:   netToPitCents,
        });
      }

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

async function runAMLChecks(
  settlementId: string,
  loadCount: number,
  grossCents: number,
  pitId: string,
  buyerUserId: string,
  date: Date
) {
  const thirtyDaysAgo = new Date(date.getTime() - 30 * 86400000);

  const [history, pit, buyer] = await Promise.all([
    prisma.settlement.findMany({
      where: { order: { pitId }, createdAt: { gte: thirtyDaysAgo }, status: "PROCESSED" },
      select: { verifiedLoadCount: true },
    }),
    prisma.pit.findUnique({ where: { id: pitId }, select: { createdAt: true } }),
    prisma.user.findUnique({ where: { id: buyerUserId }, select: { createdAt: true } }),
  ]);

  const flags: { flagType: "UNUSUAL_VOLUME" | "RAPID_LOAD_INCREASE" | "NEW_ACCOUNT_HIGH_VOLUME" | "MANUAL_REVIEW"; description: string }[] = [];

  // Flag 1: Load count 3× above 30-day average
  if (history.length > 0) {
    const avg = history.reduce((s, h) => s + h.verifiedLoadCount, 0) / history.length;
    if (loadCount > avg * 3) {
      flags.push({ flagType: "UNUSUAL_VOLUME", description: `${loadCount} loads vs ${avg.toFixed(1)} avg over last 30 days` });
    }
  }

  // Flag 2: New pit (< 30 days old) with settlement > $5,000
  if (pit) {
    const pitAgeDays = (date.getTime() - new Date(pit.createdAt).getTime()) / 86400000;
    if (pitAgeDays < 30 && grossCents > 500_000) {
      flags.push({ flagType: "NEW_ACCOUNT_HIGH_VOLUME", description: `New pit account, $${(grossCents / 100).toFixed(2)} settlement` });
    }
  }

  // Flag 3: New buyer (< 14 days old) with settlement > $2,500
  if (buyer) {
    const buyerAgeDays = (date.getTime() - new Date(buyer.createdAt).getTime()) / 86400000;
    if (buyerAgeDays < 14 && grossCents > 250_000) {
      flags.push({ flagType: "NEW_ACCOUNT_HIGH_VOLUME", description: `New buyer account, $${(grossCents / 100).toFixed(2)} first settlement` });
    }
  }

  for (const flag of flags) {
    await prisma.transactionFlag.create({
      data: { settlementId, ...flag },
    });
  }
}
