import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

// POST /api/orders/[id]/charge
// Charges all unsettled verified loads for an order immediately.
// Works on both ACTIVE and COMPLETED orders.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const order = await prisma.order.findUnique({
    where:   { id: params.id },
    include: {
      pit:   { select: { name: true, dumpRateCents: true, owner: { select: { stripeAccountId: true } } } },
      buyer: { select: { stripeCustomerId: true, defaultPaymentMethodId: true } },
    },
  });

  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.buyerUserId !== session.user.id && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!order.buyer.stripeCustomerId || !order.buyer.defaultPaymentMethodId) {
    return NextResponse.json({ error: "No payment method on file. Add a card in Billing settings first." }, { status: 422 });
  }

  // Find all verified, non-disputed loads that have NOT been settled yet
  const alreadySettledDates = await prisma.settlement.findMany({
    where:  { orderId: order.id, status: "PROCESSED" },
    select: { date: true },
  });
  const settledDates = alreadySettledDates.map((s) => s.date.toISOString().slice(0, 10));

  const loads = await prisma.loadEvent.findMany({
    where: {
      orderId:  order.id,
      verified: true,
      disputed: false,
    },
  });

  // Filter out loads from already-settled dates
  const unchargedLoads = loads.filter((l) => {
    const loadDate = new Date(l.exitTime ?? l.createdAt).toISOString().slice(0, 10);
    return !settledDates.includes(loadDate);
  });

  if (unchargedLoads.length === 0) {
    return NextResponse.json({ error: "No uncharged loads found for this order." }, { status: 422 });
  }

  const feeSettings = await prisma.platformSettings.findUnique({ where: { id: "singleton" } });
  const feePercent      = feeSettings?.feePercent ?? 8.0;
  const grossCents      = unchargedLoads.reduce((sum, l) => sum + l.rateCentsAtTime, 0);
  const commissionCents = Math.round(grossCents * (feePercent / 100));
  const netToPitCents   = grossCents - commissionCents;

  if (grossCents === 0) {
    return NextResponse.json({ error: "Total charge is $0 — check that pit rates are configured." }, { status: 422 });
  }

  const pitStripeAccountId = order.pit.owner?.stripeAccountId ?? null;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  try {
    const idempotencyKey = `manual-charge-${order.id}-${Date.now()}`;

    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount:   grossCents,
        currency: "usd",
        customer: order.buyer.stripeCustomerId!,
        payment_method: order.buyer.defaultPaymentMethodId!,
        confirm:     true,
        off_session: true,
        ...(pitStripeAccountId && {
          application_fee_amount: commissionCents,
          transfer_data: { destination: pitStripeAccountId },
        }),
        description: `Got Dirt? — Manual settlement — Order ${order.id} — ${unchargedLoads.length} loads`,
        metadata:    { order_id: order.id, load_count: String(unchargedLoads.length), manual: "true" },
      },
      { idempotencyKey }
    );

    await prisma.settlement.upsert({
      where:  { orderId_date: { orderId: order.id, date: today } },
      create: {
        orderId:           order.id,
        date:              today,
        verifiedLoadCount: unchargedLoads.length,
        grossAmountCents:  grossCents,
        commissionCents,
        netToPitCents,
        stripeChargeId:    paymentIntent.id,
        buyerPaymentMethod: "COB",
        status:            "PROCESSED",
      },
      update: {
        verifiedLoadCount: unchargedLoads.length,
        grossAmountCents:  grossCents,
        commissionCents,
        netToPitCents,
        stripeChargeId:    paymentIntent.id,
        status:            "PROCESSED",
      },
    });

    return NextResponse.json({
      ok:        true,
      loadCount: unchargedLoads.length,
      grossCents,
      chargeId:  paymentIntent.id,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
