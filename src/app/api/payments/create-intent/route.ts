import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { TransactionType } from "@prisma/client";
import { calculateTransaction } from "@/types";
import { z } from "zod";

const schema = z.object({
  pitId: z.string(),
  transactionType: z.nativeEnum(TransactionType),
  loads: z.number().int().min(1).max(1000),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { pitId, transactionType, loads } = parsed.data;

  const pit = await prisma.pit.findUnique({ where: { id: pitId } });
  if (!pit) return NextResponse.json({ error: "Pit not found" }, { status: 404 });
  if (!pit.accepting) return NextResponse.json({ error: "Pit is not accepting" }, { status: 409 });

  // Determine rate based on transaction type
  let ratePerLoadCents: number | null = null;
  if (transactionType === TransactionType.DUMP) ratePerLoadCents = pit.dumpRateCents;
  if (transactionType === TransactionType.BORROW) ratePerLoadCents = pit.borrowRateCents;
  if (transactionType === TransactionType.TOPSOIL) ratePerLoadCents = pit.topsoilRateCents;

  if (!ratePerLoadCents) {
    return NextResponse.json({ error: "Rate not available for this transaction type" }, { status: 400 });
  }

  // Get owner Stripe account
  const owner = pit.ownerId ? await prisma.user.findUnique({ where: { id: pit.ownerId } }) : null;
  if (!owner?.stripeAccountId || !owner.stripeOnboarded) {
    return NextResponse.json({ error: "Pit owner has not set up payments" }, { status: 409 });
  }

  // Get platform fee
  const settings = await prisma.platformSettings.findUnique({ where: { id: "singleton" } });
  const feePercent = settings?.feePercent ?? 8.0;

  const calc = calculateTransaction(ratePerLoadCents, loads, feePercent);

  // Ensure contractor has a Stripe customer ID
  let customerId = session.user.stripeAccountId;
  const contractor = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!contractor?.stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: session.user.email ?? undefined,
      name: session.user.name ?? undefined,
    });
    await prisma.user.update({
      where: { id: session.user.id },
      data: { stripeCustomerId: customer.id },
    });
    customerId = customer.id;
  } else {
    customerId = contractor.stripeCustomerId;
  }

  // Create transaction record
  const transaction = await prisma.transaction.create({
    data: {
      pitId,
      contractorId: session.user.id,
      pitOwnerAccountId: owner.stripeAccountId,
      transactionType,
      loads,
      ratePerLoadCents,
      subtotalCents: calc.subtotalCents,
      platformFeeCents: calc.platformFeeCents,
      ownerPayoutCents: calc.ownerPayoutCents,
      totalChargeCents: calc.totalChargeCents,
      platformFeePercent: feePercent,
    },
  });

  // Create Stripe PaymentIntent
  const paymentIntent = await stripe.paymentIntents.create({
    amount: calc.totalChargeCents,
    currency: "usd",
    customer: customerId as string,
    metadata: {
      transactionId: transaction.id,
      pitId,
      pitName: pit.name,
      transactionType,
      loads: String(loads),
    },
    description: `Got Dirt? — ${pit.name} (${transactionType} × ${loads} loads)`,
  });

  await prisma.transaction.update({
    where: { id: transaction.id },
    data: { stripePaymentIntentId: paymentIntent.id },
  });

  return NextResponse.json({
    clientSecret: paymentIntent.client_secret,
    transactionId: transaction.id,
    calculation: calc,
  });
}
