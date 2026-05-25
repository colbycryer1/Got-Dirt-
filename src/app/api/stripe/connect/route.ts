import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { UserRole } from "@prisma/client";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });

  // If there's a connected Stripe account, fetch live status directly from Stripe
  // so the UI always reflects the real state regardless of webhook delivery.
  if (user?.stripeAccountId) {
    const account = await stripe.accounts.retrieve(user.stripeAccountId);
    const payoutsEnabled  = account.payouts_enabled  ?? false;
    const chargesEnabled  = account.charges_enabled  ?? false;
    const requirementsDue = account.requirements?.currently_due ?? [];

    // Keep DB in sync while we're here
    await Promise.all([
      prisma.user.update({
        where: { id: session.user.id },
        data:  { stripeOnboarded: chargesEnabled },
      }),
      prisma.pitOwnerCompliance.upsert({
        where:  { pitOwnerUserId: session.user.id },
        create: {
          pitOwnerUserId: session.user.id,
          payoutsEnabled,
          chargesEnabled,
          requirementsDue,
          kycStatus:      payoutsEnabled ? "VERIFIED" : "PENDING",
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
      }),
    ]);

    return NextResponse.json({
      stripeAccountId: user.stripeAccountId,
      stripeOnboarded: chargesEnabled,
      kycStatus:       payoutsEnabled ? "VERIFIED" : "PENDING",
      payoutsEnabled,
      chargesEnabled,
      requirementsDue,
    });
  }

  return NextResponse.json({
    stripeAccountId: null,
    stripeOnboarded: false,
    kycStatus:       "NOT_STARTED",
    payoutsEnabled:  false,
    chargesEnabled:  false,
    requirementsDue: [],
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== UserRole.PIT_OWNER && session.user.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Only pit owners can connect Stripe" }, { status: 403 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  let accountId = user?.stripeAccountId;

  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      email: user?.email ?? undefined,
      capabilities: { transfers: { requested: true } },
      business_type: "individual",
    });
    accountId = account.id;
    await prisma.user.update({
      where: { id: session.user.id },
      data: { stripeAccountId: accountId },
    });
  }

  const appUrl = new URL(req.url).origin;
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${appUrl}/account/stripe?refresh=true`,
    return_url:  `${appUrl}/account/stripe?success=true`,
    type: "account_onboarding",
  });

  // Upsert compliance record with the onboarding URL
  await prisma.pitOwnerCompliance.upsert({
    where:  { pitOwnerUserId: session.user.id },
    create: { pitOwnerUserId: session.user.id, kycStatus: "PENDING", stripeOnboardingUrl: accountLink.url },
    update: { stripeOnboardingUrl: accountLink.url, kycStatus: "PENDING" },
  });

  return NextResponse.json({ url: accountLink.url });
}
