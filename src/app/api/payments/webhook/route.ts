import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { TransactionStatus } from "@prisma/client";
import Stripe from "stripe";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) return NextResponse.json({ error: "No signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    return NextResponse.json({ error: `Webhook error: ${(err as Error).message}` }, { status: 400 });
  }

  switch (event.type) {
    case "payment_intent.succeeded": {
      const intent = event.data.object as Stripe.PaymentIntent;
      const transactionId = intent.metadata?.transactionId;
      if (!transactionId) break;

      const transaction = await prisma.transaction.findUnique({
        where: { id: transactionId },
      });
      if (!transaction || transaction.status !== TransactionStatus.PENDING) break;

      // Transfer pit owner's payout to their connected account
      try {
        const transfer = await stripe.transfers.create({
          amount: transaction.ownerPayoutCents,
          currency: "usd",
          destination: transaction.pitOwnerAccountId,
          transfer_group: transactionId,
          metadata: { transactionId, pitId: transaction.pitId },
        });

        // Generate sequential invoice number
        const invoiceCount = await prisma.invoice.count();
        const invoiceNumber = `GOT-${new Date().getFullYear()}-${String(invoiceCount + 1).padStart(6, "0")}`;

        await prisma.$transaction([
          prisma.transaction.update({
            where: { id: transactionId },
            data: {
              status: TransactionStatus.SUCCEEDED,
              stripeTransferId: transfer.id,
            },
          }),
          prisma.invoice.create({
            data: {
              invoiceNumber,
              transactionId,
              sentToEmail: null,
            },
          }),
        ]);
      } catch (err) {
        console.error("Transfer failed:", err);
        await prisma.transaction.update({
          where: { id: transactionId },
          data: { status: TransactionStatus.FAILED },
        });
      }
      break;
    }

    case "payment_intent.payment_failed": {
      const intent = event.data.object as Stripe.PaymentIntent;
      const transactionId = intent.metadata?.transactionId;
      if (transactionId) {
        await prisma.transaction.update({
          where: { id: transactionId },
          data: { status: TransactionStatus.FAILED },
        });
      }
      break;
    }

    case "account.updated": {
      const account = event.data.object as Stripe.Account;
      const payoutsEnabled = account.payouts_enabled ?? false;
      const chargesEnabled = account.charges_enabled ?? false;
      const requirementsDue = account.requirements?.currently_due ?? [];

      // Update user onboarding flag
      await prisma.user.updateMany({
        where: { stripeAccountId: account.id },
        data:  { stripeOnboarded: chargesEnabled },
      });

      // Sync detailed KYC compliance record
      const user = await prisma.user.findFirst({ where: { stripeAccountId: account.id }, select: { id: true } });
      if (user) {
        await prisma.pitOwnerCompliance.upsert({
          where:  { pitOwnerUserId: user.id },
          create: {
            pitOwnerUserId: user.id,
            payoutsEnabled,
            chargesEnabled,
            requirementsDue,
            kycStatus:     payoutsEnabled ? "VERIFIED" : "PENDING",
            kycCompletedAt: payoutsEnabled ? new Date() : undefined,
            lastCheckedAt:  new Date(),
          },
          update: {
            payoutsEnabled,
            chargesEnabled,
            requirementsDue,
            kycStatus:      payoutsEnabled ? "VERIFIED" : "PENDING",
            kycCompletedAt: payoutsEnabled ? new Date() : undefined,
            lastCheckedAt:  new Date(),
          },
        });
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
