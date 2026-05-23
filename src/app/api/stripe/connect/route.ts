import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { UserRole } from "@prisma/client";

// GET — check onboarding status
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  return NextResponse.json({
    stripeAccountId: user?.stripeAccountId,
    stripeOnboarded: user?.stripeOnboarded ?? false,
  });
}

// POST — create or retrieve Stripe Connect account link
export async function POST() {
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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${appUrl}/account/stripe?refresh=true`,
    return_url: `${appUrl}/account/stripe?success=true`,
    type: "account_onboarding",
  });

  return NextResponse.json({ url: accountLink.url });
}
