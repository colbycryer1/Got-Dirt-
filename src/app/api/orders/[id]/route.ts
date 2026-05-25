import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { OrderStatus } from "@prisma/client";

type Ctx = { params: { id: string } };

// PATCH /api/orders/[id]  { status: "COMPLETED" | "CANCELLED" }
// When completing, automatically charges any uncharged verified loads.
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { status } = await req.json() as { status: string };
  if (status !== "COMPLETED" && status !== "CANCELLED") {
    return NextResponse.json({ error: "status must be COMPLETED or CANCELLED" }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where:   { id: params.id },
    include: {
      pit:   { select: { name: true, owner: { select: { stripeAccountId: true } } } },
      buyer: { select: { stripeCustomerId: true, defaultPaymentMethodId: true } },
    },
  });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const isOwner = order.buyerUserId === session.user.id;
  const isAdmin = session.user.role === "ADMIN";
  if (!isOwner && !isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (order.status !== OrderStatus.ACTIVE) {
    return NextResponse.json({ error: "Only active orders can be closed out" }, { status: 409 });
  }

  // Close the order first
  const updated = await prisma.order.update({
    where: { id: params.id },
    data:  { status: status as OrderStatus },
  });

  // On completion, charge any uncharged loads immediately
  if (status === "COMPLETED") {
    const chargeResult = await chargeUnpaidLoads(params.id, order);
    return NextResponse.json({ order: updated, charge: chargeResult });
  }

  return NextResponse.json({ order: updated, charge: null });
}

interface OrderForCharge {
  buyerUserId: string;
  pitId: string;
  pit: { name: string; owner: { stripeAccountId: string | null } | null };
  buyer: { stripeCustomerId: string | null; defaultPaymentMethodId: string | null };
}

async function chargeUnpaidLoads(orderId: string, order: OrderForCharge) {
  // No payment method — flag the debt but don't block the close
  if (!order.buyer.stripeCustomerId || !order.buyer.defaultPaymentMethodId) {
    return { status: "no_payment_method", message: "No payment method on file — loads are owed." };
  }

  // Find all verified loads not yet covered by a processed settlement
  const settledDates = (await prisma.settlement.findMany({
    where:  { orderId, status: "PROCESSED" },
    select: { date: true },
  })).map((s) => s.date.toISOString().slice(0, 10));

  const loads = await prisma.loadEvent.findMany({
    where: { orderId, verified: true, disputed: false },
  });

  const unchargedLoads = loads.filter((l) => {
    const d = new Date(l.exitTime ?? l.createdAt).toISOString().slice(0, 10);
    return !settledDates.includes(d);
  });

  if (unchargedLoads.length === 0) {
    return { status: "nothing_to_charge" };
  }

  const feeSettings = await prisma.platformSettings.findUnique({ where: { id: "singleton" } });
  const feePercent      = feeSettings?.feePercent ?? 8.0;
  const grossCents      = unchargedLoads.reduce((s, l) => s + l.rateCentsAtTime, 0);
  const commissionCents = Math.round(grossCents * (feePercent / 100));
  const netToPitCents   = grossCents - commissionCents;

  if (grossCents === 0) {
    return { status: "zero_amount", message: "Loads have $0 rate — check pit pricing." };
  }

  const pitStripeAccountId = order.pit.owner?.stripeAccountId ?? null;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  try {
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
        description: `Got Dirt? — Close-out charge — Order ${orderId} — ${unchargedLoads.length} loads`,
        metadata:    { order_id: orderId, load_count: String(unchargedLoads.length), trigger: "closeout" },
      },
      { idempotencyKey: `closeout-${orderId}-${today.toISOString().slice(0, 10)}` }
    );

    await prisma.settlement.upsert({
      where:  { orderId_date: { orderId, date: today } },
      create: {
        orderId,
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

    return {
      status:    "charged",
      loadCount: unchargedLoads.length,
      grossCents,
      chargeId:  paymentIntent.id,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { status: "charge_failed", message: msg };
  }
}
