import { NextRequest, NextResponse } from "next/server";
import { getMobileToken, verifyMobileJWT } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const token = getMobileToken(_req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let user;
  try { user = await verifyMobileJWT(token); } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const order = await prisma.order.findUnique({
    where:   { id: params.id },
    include: {
      pit:   { select: { name: true, owner: { select: { stripeAccountId: true } } } },
      buyer: { select: { stripeCustomerId: true, defaultPaymentMethodId: true } },
    },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (order.buyerUserId !== user.id && user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!order.buyer.stripeCustomerId || !order.buyer.defaultPaymentMethodId) {
    return NextResponse.json({ error: "No payment method on file. Add a card in the web dashboard." }, { status: 422 });
  }

  const settledDates = (await prisma.settlement.findMany({
    where:  { orderId: order.id, status: "PROCESSED" },
    select: { date: true },
  })).map((s) => s.date.toISOString().slice(0, 10));

  const loads = await prisma.loadEvent.findMany({
    where: { orderId: order.id, verified: true, disputed: false },
  });

  const uncharged = loads.filter((l) => {
    const d = new Date(l.exitTime ?? l.createdAt).toISOString().slice(0, 10);
    return !settledDates.includes(d);
  });

  if (uncharged.length === 0) {
    return NextResponse.json({ error: "No uncharged loads found." }, { status: 422 });
  }

  const feeSettings   = await prisma.platformSettings.findUnique({ where: { id: "singleton" } });
  const feePercent    = feeSettings?.feePercent ?? 8.0;
  const grossCents    = uncharged.reduce((s, l) => s + l.rateCentsAtTime, 0);
  const commission    = Math.round(grossCents * (feePercent / 100));
  const netToPitCents = grossCents - commission;
  if (grossCents === 0) return NextResponse.json({ error: "Total is $0 — check pit rates." }, { status: 422 });

  const pitAccount = order.pit.owner?.stripeAccountId ?? null;
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);

  const pi = await stripe.paymentIntents.create({
    amount:   grossCents, currency: "usd",
    customer: order.buyer.stripeCustomerId!,
    payment_method: order.buyer.defaultPaymentMethodId!,
    confirm: true, off_session: true,
    ...(pitAccount && { application_fee_amount: commission, transfer_data: { destination: pitAccount } }),
    description: `Got Dirt? mobile charge — Order ${order.id} — ${uncharged.length} loads`,
  });

  await prisma.settlement.upsert({
    where:  { orderId_date: { orderId: order.id, date: today } },
    create: { orderId: order.id, date: today, verifiedLoadCount: uncharged.length, grossAmountCents: grossCents, commissionCents: commission, netToPitCents, stripeChargeId: pi.id, buyerPaymentMethod: "COB", status: "PROCESSED" },
    update: { verifiedLoadCount: uncharged.length, grossAmountCents: grossCents, commissionCents: commission, netToPitCents, stripeChargeId: pi.id, status: "PROCESSED" },
  });

  return NextResponse.json({ ok: true, loadCount: uncharged.length, grossCents, chargeId: pi.id });
}
