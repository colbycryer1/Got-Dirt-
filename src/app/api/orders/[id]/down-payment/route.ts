import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

type Ctx = { params: { id: string } };

// POST /api/orders/[id]/down-payment
// Charges the buyer's saved card for the down payment % on a net terms order.
// Called immediately after order creation when buyer has downPaymentPct > 0.
export async function POST(_req: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      pit: { select: { name: true, dumpRateCents: true, borrowRateCents: true } },
      buyer: { select: { stripeCustomerId: true, defaultPaymentMethodId: true } },
      downPaymentTransaction: true,
    },
  });

  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.buyerUserId !== session.user.id && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Already charged
  if (order.downPaymentTransaction?.status === "SUCCEEDED") {
    return NextResponse.json({ alreadyPaid: true });
  }

  const netTermsAccount = await prisma.netTermsAccount.findUnique({
    where: { buyerUserId: order.buyerUserId },
  });

  if (!netTermsAccount || netTermsAccount.downPaymentPct <= 0) {
    return NextResponse.json({ error: "No down payment required for this order" }, { status: 400 });
  }

  if (!order.estimatedLoads) {
    return NextResponse.json(
      { error: "Set estimated loads on the order before collecting a down payment" },
      { status: 400 }
    );
  }

  if (!order.buyer.stripeCustomerId || !order.buyer.defaultPaymentMethodId) {
    return NextResponse.json(
      { error: "No saved payment method on file. Add a card in account settings first." },
      { status: 400 }
    );
  }

  // Estimate based on dump rate (most common); uses best available rate
  const ratePerLoad = order.pit.dumpRateCents ?? order.pit.borrowRateCents ?? 0;
  const estimatedGross = ratePerLoad * order.estimatedLoads;
  const downPaymentCents = Math.round(estimatedGross * (netTermsAccount.downPaymentPct / 100));

  if (downPaymentCents < 50) {
    return NextResponse.json({ error: "Down payment amount too small to charge" }, { status: 400 });
  }

  try {
    const idempotencyKey = `dp-${order.id}`;

    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount:         downPaymentCents,
        currency:       "usd",
        customer:       order.buyer.stripeCustomerId,
        payment_method: order.buyer.defaultPaymentMethodId,
        confirm:        true,
        off_session:    true,
        description:    `Got Dirt? — Down payment (${netTermsAccount.downPaymentPct}%) — Order ${order.id}`,
        metadata:       { order_id: order.id, type: "down_payment" },
      },
      { idempotencyKey }
    );

    await prisma.downPaymentTransaction.upsert({
      where: { orderId: order.id },
      create: {
        orderId:               order.id,
        amountCents:           downPaymentCents,
        stripePaymentIntentId: paymentIntent.id,
        status:                paymentIntent.status === "succeeded" ? "SUCCEEDED" : "PENDING",
      },
      update: {
        stripePaymentIntentId: paymentIntent.id,
        status:                paymentIntent.status === "succeeded" ? "SUCCEEDED" : "PENDING",
      },
    });

    return NextResponse.json({
      ok: true,
      amountCents: downPaymentCents,
      status: paymentIntent.status,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Payment failed";

    await prisma.downPaymentTransaction.upsert({
      where: { orderId: order.id },
      create: { orderId: order.id, amountCents: downPaymentCents, status: "FAILED" },
      update: { status: "FAILED" },
    });

    return NextResponse.json({ error: msg }, { status: 402 });
  }
}

// GET /api/orders/[id]/down-payment — check status
export async function GET(_req: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dp = await prisma.downPaymentTransaction.findUnique({
    where: { orderId: params.id },
  });

  return NextResponse.json({ downPayment: dp });
}
