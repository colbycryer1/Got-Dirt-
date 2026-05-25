import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

// GET — return current payment method status
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where:  { id: session.user.id },
    select: { stripeCustomerId: true, defaultPaymentMethodId: true },
  });

  if (!user?.stripeCustomerId || !user?.defaultPaymentMethodId) {
    return NextResponse.json({ hasPaymentMethod: false, card: null });
  }

  try {
    const pm = await stripe.paymentMethods.retrieve(user.defaultPaymentMethodId);
    return NextResponse.json({
      hasPaymentMethod: true,
      card: pm.card ? { brand: pm.card.brand, last4: pm.card.last4, expMonth: pm.card.exp_month, expYear: pm.card.exp_year } : null,
    });
  } catch {
    return NextResponse.json({ hasPaymentMethod: false, card: null });
  }
}

// POST — create/retrieve Stripe customer + return SetupIntent clientSecret
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where:  { id: session.user.id },
    select: { stripeCustomerId: true, email: true, name: true },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name:  user.name ?? undefined,
      metadata: { userId: session.user.id },
    });
    customerId = customer.id;
    await prisma.user.update({
      where: { id: session.user.id },
      data:  { stripeCustomerId: customerId },
    });
  }

  const setupIntent = await stripe.setupIntents.create({
    customer: customerId,
    payment_method_types: ["card"],
    usage: "off_session",
  });

  return NextResponse.json({ clientSecret: setupIntent.client_secret });
}

// PATCH — called after setupIntent confirms; saves the payment method
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { setupIntentId } = await req.json() as { setupIntentId: string };
  if (!setupIntentId) return NextResponse.json({ error: "setupIntentId required" }, { status: 400 });

  const intent = await stripe.setupIntents.retrieve(setupIntentId);
  if (intent.status !== "succeeded") {
    return NextResponse.json({ error: "Setup not completed" }, { status: 400 });
  }

  const paymentMethodId = typeof intent.payment_method === "string"
    ? intent.payment_method
    : intent.payment_method?.id;

  if (!paymentMethodId) return NextResponse.json({ error: "No payment method" }, { status: 400 });

  // Attach to customer and set as default
  const user = await prisma.user.findUnique({
    where:  { id: session.user.id },
    select: { stripeCustomerId: true },
  });

  if (user?.stripeCustomerId) {
    await stripe.customers.update(user.stripeCustomerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data:  { defaultPaymentMethodId: paymentMethodId },
  });

  const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
  return NextResponse.json({
    ok: true,
    card: pm.card ? { brand: pm.card.brand, last4: pm.card.last4 } : null,
  });
}
