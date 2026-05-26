import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

// Runs hourly via Vercel Cron.
// Sweeps HaulOrders whose cobDueAt has passed and processes COB payment automatically.

function isCronAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${process.env.CRON_SECRET}`) return true;
  return req.headers.get("x-cron-secret") === process.env.CRON_SECRET;
}

interface SettleResult {
  haulOrderId: string;
  status: "processed" | "skipped" | "no_stripe" | "zero_loads" | "failed";
  actualLoads?: number;
  totalCents?: number;
  error?: string;
}

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const results = await runHaulCOBSettlement();
  return NextResponse.json({ processed: results.filter((r) => r.status === "processed").length, results });
}

export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const results = await runHaulCOBSettlement();
  return NextResponse.json({ processed: results.filter((r) => r.status === "processed").length, results });
}

async function runHaulCOBSettlement(): Promise<SettleResult[]> {
  const now = new Date();

  // Find haul orders whose COB deadline has passed and haven't been completed yet
  const due = await prisma.haulOrder.findMany({
    where: {
      cobDueAt: { lte: now },
      status:   { in: ["CONFIRMED", "ACTIVE"] },
    },
    select: {
      id:                     true,
      actualLoads:            true,
      haulRateCents:          true,
      pitMaterialRateCents:   true,
      depositHoldCents:       true,
      stripePaymentIntentId:  true,
      afterHoursFeeCents:     true,
      platformFeePercent:     true,
      buyer: {
        select: { stripeCustomerId: true, defaultPaymentMethodId: true, email: true, name: true },
      },
    },
  });

  const settings       = await prisma.platformSettings.findUnique({ where: { id: "singleton" } });
  const haulFeePercent = settings?.haulFeePercent ?? 10.0;
  const matFeePercent  = settings?.feePercent      ?? 8.0;

  const results: SettleResult[] = [];
  const STRIPE_MIN = 50;

  for (const order of due) {
    const actualLoads = order.actualLoads ?? 0;

    if (actualLoads === 0) {
      // No loads recorded — cancel the hold and mark complete
      if (order.stripePaymentIntentId) {
        try { await stripe.paymentIntents.cancel(order.stripePaymentIntentId); } catch {}
      }
      await prisma.haulOrder.update({
        where: { id: order.id },
        data:  {
          status:                 "COMPLETED",
          platformFeePercent:     haulFeePercent,
          platformFeeCents:       0,
          haulerPayoutCents:      0,
          pitMaterialPayoutCents: 0,
          pitMaterialFeeCents:    0,
        },
      });
      results.push({ haulOrderId: order.id, status: "zero_loads", actualLoads: 0, totalCents: 0 });
      continue;
    }

    const haulCents            = actualLoads * order.haulRateCents;
    const materialCents        = actualLoads * (order.pitMaterialRateCents ?? 0);
    const baseCents            = haulCents + materialCents;
    const totalCents           = baseCents + (order.afterHoursFeeCents ?? 0);

    const haulPlatformFee      = Math.round(haulCents * haulFeePercent / 100);
    const haulerPayout         = haulCents - haulPlatformFee;
    const matPlatformFee       = Math.round(materialCents * matFeePercent / 100);
    const pitMaterialPayout    = materialCents - matPlatformFee;
    const platformFeeCents     = haulPlatformFee + matPlatformFee;

    if (!order.stripePaymentIntentId) {
      // No Stripe hold — just mark complete (buyer-operating or non-Stripe order)
      await prisma.haulOrder.update({
        where: { id: order.id },
        data:  {
          status:                 "COMPLETED",
          actualLoads,
          platformFeePercent:     haulFeePercent,
          platformFeeCents,
          haulerPayoutCents:      haulerPayout,
          pitMaterialPayoutCents: pitMaterialPayout,
          pitMaterialFeeCents:    matPlatformFee,
        },
      });
      results.push({ haulOrderId: order.id, status: "no_stripe", actualLoads, totalCents });
      continue;
    }

    try {
      const chargeAmount = Math.max(totalCents, STRIPE_MIN);

      if (totalCents <= order.depositHoldCents) {
        // Capture partial
        await stripe.paymentIntents.capture(order.stripePaymentIntentId, {
          amount_to_capture: chargeAmount,
        });
      } else {
        // Capture full deposit first
        await stripe.paymentIntents.capture(order.stripePaymentIntentId);

        // Charge overage (includes after-hours fee if any)
        const overageCents = totalCents - order.depositHoldCents;
        const buyer = order.buyer;
        if (
          buyer.stripeCustomerId &&
          buyer.defaultPaymentMethodId &&
          overageCents >= STRIPE_MIN
        ) {
          await stripe.paymentIntents.create({
            amount:         overageCents,
            currency:       "usd",
            customer:       buyer.stripeCustomerId,
            payment_method: buyer.defaultPaymentMethodId,
            confirm:        true,
            off_session:    true,
            description:    `Got Dirt? — Haul COB overage (${actualLoads} loads) — Order ${order.id}`,
            metadata:       { haulOrderId: order.id, type: "cob_overage" },
          });
        }
      }

      await prisma.haulOrder.update({
        where: { id: order.id },
        data:  {
          status:                 "COMPLETED",
          actualLoads,
          platformFeePercent:     haulFeePercent,
          platformFeeCents,
          haulerPayoutCents:      haulerPayout,
          pitMaterialPayoutCents: pitMaterialPayout,
          pitMaterialFeeCents:    matPlatformFee,
        },
      });

      results.push({ haulOrderId: order.id, status: "processed", actualLoads, totalCents });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      results.push({ haulOrderId: order.id, status: "failed", actualLoads, totalCents, error });
    }
  }

  return results;
}
