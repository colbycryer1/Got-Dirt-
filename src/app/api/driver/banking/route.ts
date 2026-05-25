import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { NextResponse } from "next/server";

// GET /api/driver/banking — returns driver's Stripe Express account status
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "DRIVER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { stripeAccountId: true, stripeOnboarded: true },
  });

  if (user?.stripeAccountId) {
    const account = await stripe.accounts.retrieve(user.stripeAccountId);
    const payoutsEnabled = account.payouts_enabled ?? false;
    const chargesEnabled = account.charges_enabled ?? false;

    await prisma.user.update({
      where: { id: session.user.id },
      data:  { stripeOnboarded: payoutsEnabled },
    });

    return NextResponse.json({
      stripeAccountId: user.stripeAccountId,
      payoutsEnabled,
      chargesEnabled,
      requirementsDue: account.requirements?.currently_due ?? [],
    });
  }

  return NextResponse.json({
    stripeAccountId: null,
    payoutsEnabled:  false,
    chargesEnabled:  false,
    requirementsDue: [],
  });
}

// POST /api/driver/banking — create or refresh Stripe Express onboarding link
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "DRIVER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { stripeAccountId: true, email: true },
  });

  let accountId = user?.stripeAccountId;
  if (!accountId) {
    const account = await stripe.accounts.create({
      type:          "express",
      email:         user?.email ?? undefined,
      capabilities:  { transfers: { requested: true } },
      business_type: "individual",
    });
    accountId = account.id;
    await prisma.user.update({
      where: { id: session.user.id },
      data:  { stripeAccountId: accountId },
    });
  }

  const appUrl = new URL(req.url).origin;
  const link = await stripe.accountLinks.create({
    account:     accountId,
    refresh_url: `${appUrl}/dashboard/driver/banking?refresh=true`,
    return_url:  `${appUrl}/dashboard/driver/banking?success=true`,
    type:        "account_onboarding",
  });

  return NextResponse.json({ url: link.url });
}
