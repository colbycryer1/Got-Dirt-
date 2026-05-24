import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isBuyerRole } from "@/types";

const createSchema = z.object({
  driverId:      z.string().optional(),  // DriverProfile.id
  carrierId:     z.string().optional(),  // CarrierProfile.id
  pitId:         z.string().optional(),
  projectId:     z.string().optional(),
  scheduledDate: z.string().datetime(),
  loads:         z.number().int().min(1),
  haulRateCents:         z.number().int().min(0),
  totalEstimatedCents:   z.number().int().min(0),
  depositHoldCents:      z.number().int().min(0),
  notes:         z.string().optional(),
  expiresAt:     z.string().datetime().optional(),
}).refine((d) => !!(d.driverId || d.carrierId), {
  message: "Either driverId or carrierId is required",
}).refine((d) => !(d.driverId && d.carrierId), {
  message: "Cannot assign both a driver and a carrier",
});

// GET /api/haul-orders — list for the current user (buyer, driver, or carrier)
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;

  let orders;
  if (role === "DRIVER") {
    orders = await prisma.haulOrder.findMany({
      where:   { driver: { userId: session.user.id } },
      include: {
        buyer:   { select: { name: true, company: true, phone: true } },
        pit:     { select: { name: true, state: true } },
        project: { select: { name: true } },
      },
      orderBy: { scheduledDate: "asc" },
    });
  } else if (role === "CARRIER") {
    // CARRIER sees orders assigned to them as a carrier
    orders = await prisma.haulOrder.findMany({
      where:   { carrier: { userId: session.user.id } },
      include: {
        buyer:   { select: { name: true, company: true, phone: true } },
        pit:     { select: { name: true, state: true } },
        project: { select: { name: true } },
      },
      orderBy: { scheduledDate: "asc" },
    });
  } else if (isBuyerRole(role)) {
    // BUYER / CONTRACTOR — see orders they placed
    orders = await prisma.haulOrder.findMany({
      where:   { buyerUserId: session.user.id },
      include: {
        driver:  { include: { user: { select: { name: true, phone: true } } } },
        carrier: { include: { user: { select: { name: true, phone: true } } } },
        pit:     { select: { name: true, state: true } },
        project: { select: { name: true } },
      },
      orderBy: { scheduledDate: "asc" },
    });
  } else {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ orders });
}

// POST /api/haul-orders — buyer creates a haul order
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isBuyerRole(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Ensure buyer has a Stripe customer ID for the deposit hold
  const buyer = await prisma.user.findUnique({ where: { id: session.user.id } });
  let customerId = buyer?.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: session.user.email ?? undefined,
      name:  session.user.name ?? undefined,
    });
    await prisma.user.update({ where: { id: session.user.id }, data: { stripeCustomerId: customer.id } });
    customerId = customer.id;
  }

  // Create haul order first so we have an ID for the PaymentIntent metadata
  const order = await prisma.haulOrder.create({
    data: {
      buyerUserId:  session.user.id,
      ...parsed.data,
      scheduledDate: new Date(parsed.data.scheduledDate),
      expiresAt:     parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : undefined,
    },
  });

  // Create a manual-capture PaymentIntent for the deposit hold
  // This authorizes the card but does NOT charge it yet — captured on completion
  let clientSecret: string | null = null;
  if (parsed.data.depositHoldCents > 0) {
    const pi = await stripe.paymentIntents.create({
      amount:         parsed.data.depositHoldCents,
      currency:       "usd",
      customer:       customerId,
      capture_method: "manual",
      metadata: {
        haulOrderId:  order.id,
        orderedBy:    session.user.id,
      },
      description: `Got Dirt? — Haul deposit hold (${parsed.data.loads} load${parsed.data.loads !== 1 ? "s" : ""})`,
    });
    await prisma.haulOrder.update({
      where: { id: order.id },
      data:  { stripePaymentIntentId: pi.id },
    });
    clientSecret = pi.client_secret;
  }

  return NextResponse.json({ order, clientSecret }, { status: 201 });
}
