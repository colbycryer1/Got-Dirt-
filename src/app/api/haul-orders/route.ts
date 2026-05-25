import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isBuyerRole } from "@/types";
import { sendHaulRequestToHauler, sendHaulBroadcast } from "@/lib/email";

const createSchema = z.object({
  driverId:      z.string().optional(),
  carrierId:     z.string().optional(),
  broadcast:     z.boolean().optional().default(false),
  buyerOperating:        z.boolean().optional().default(false),
  operatorTruckType:     z.string().optional(),
  operatorTruckRateCents: z.number().int().min(0).optional(),
  pitId:         z.string().optional(),
  projectId:     z.string().optional(),
  scheduledDate: z.string().datetime(),
  loads:         z.number().int().min(1),
  haulRateCents:         z.number().int().min(0),
  totalEstimatedCents:   z.number().int().min(0),
  depositHoldCents:      z.number().int().min(0),
  notes:         z.string().optional(),
  expiresAt:     z.string().datetime().optional(),
}).refine((d) => !(d.driverId && d.carrierId), {
  message: "Cannot assign both a driver and a carrier",
}).refine((d) => d.broadcast || d.buyerOperating || d.driverId || d.carrierId, {
  message: "Select a hauler, enable broadcast, or choose Buyer/Operator mode",
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

// POST /api/haul-orders — buyer creates a haul order (direct request or open broadcast)
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isBuyerRole(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const [buyer, platformSettings] = await Promise.all([
    prisma.user.findUnique({
      where:  { id: session.user.id },
      select: { name: true, company: true, email: true, stripeCustomerId: true },
    }),
    prisma.platformSettings.findUnique({ where: { id: "singleton" } }),
  ]);

  let customerId = buyer?.stripeCustomerId;
  if (!customerId && parsed.data.depositHoldCents > 0) {
    const customer = await stripe.customers.create({
      email: session.user.email ?? undefined,
      name:  session.user.name ?? undefined,
    });
    await prisma.user.update({ where: { id: session.user.id }, data: { stripeCustomerId: customer.id } });
    customerId = customer.id;
  }

  const { broadcast, ...orderData } = parsed.data;

  const isBuyerOp = parsed.data.buyerOperating === true;

  // Detect pit-rate broadcast: pit has a rate locked today → broadcast to ALL haulers
  let pitRateBroadcast = false;
  let resolvedHaulRate = orderData.haulRateCents;
  if (broadcast && orderData.pitId) {
    const pit = await prisma.pit.findUnique({
      where:  { id: orderData.pitId },
      select: { dailyHaulRateCents: true, dailyHaulRateLockedAt: true },
    });
    if (pit?.dailyHaulRateCents && pit.dailyHaulRateLockedAt) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (pit.dailyHaulRateLockedAt >= today) {
        pitRateBroadcast  = true;
        resolvedHaulRate  = pit.dailyHaulRateCents;
      }
    }
  }

  const haulFeePercent    = isBuyerOp ? 0 : (platformSettings?.haulFeePercent ?? 10.0);
  const resolvedTotal     = resolvedHaulRate * orderData.loads;
  const platformFeeCents  = isBuyerOp ? 0 : Math.round(resolvedTotal * haulFeePercent / 100);
  const haulerPayoutCents = isBuyerOp ? 0 : resolvedTotal - platformFeeCents;

  const order = await prisma.haulOrder.create({
    data: {
      buyerUserId:  session.user.id,
      ...orderData,
      haulRateCents:        resolvedHaulRate,
      totalEstimatedCents:  resolvedTotal,
      scheduledDate:        new Date(orderData.scheduledDate),
      expiresAt:            orderData.expiresAt ? new Date(orderData.expiresAt) : undefined,
      status:               isBuyerOp ? "CONFIRMED" : undefined,
      broadcast,
      pitRateBroadcast,
      platformFeePercent:   haulFeePercent,
      platformFeeCents,
      haulerPayoutCents,
    },
  });

  // Buyer/Operator orders are self-haul cost-tracking only — no Stripe, no notifications
  if (isBuyerOp) {
    return NextResponse.json({ order, clientSecret: null }, { status: 201 });
  }

  let clientSecret: string | null = null;
  if (parsed.data.depositHoldCents > 0 && customerId) {
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

  // Send notifications
  const scheduledStr = new Date(parsed.data.scheduledDate).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
  const buyerCompany = buyer?.company ?? buyer?.name ?? null;

  if (broadcast) {
    // Buyer-rate broadcasts go to INDEPENDENT DRIVERS ONLY.
    // Pit-rate broadcasts (pit owner locked a daily rate) go to ALL haulers.
    const [drivers, carriers] = await Promise.all([
      prisma.driverProfile.findMany({
        where:  { profilePublic: true, docsVerified: true },
        select: { user: { select: { email: true, name: true } } },
      }),
      pitRateBroadcast
        ? prisma.carrierProfile.findMany({
            where:  { profilePublic: true },
            select: { user: { select: { email: true } } },
          })
        : Promise.resolve([]),
    ]);
    const emails = [
      ...drivers.map((d) => d.user.email).filter(Boolean),
      ...carriers.map((c) => c.user.email).filter(Boolean),
    ] as string[];
    if (emails.length > 0) {
      sendHaulBroadcast({
        haulerEmails: emails,
        buyerCompany,
        loads:         parsed.data.loads,
        rateCents:     parsed.data.haulRateCents,
        scheduledDate: scheduledStr,
        expiresAt:     parsed.data.expiresAt
          ? new Date(parsed.data.expiresAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
          : null,
      }).catch(console.error);
    }
  } else if (parsed.data.driverId) {
    const profile = await prisma.driverProfile.findUnique({
      where:  { id: parsed.data.driverId },
      select: { user: { select: { email: true, name: true } } },
    });
    if (profile?.user.email) {
      sendHaulRequestToHauler({
        haulerEmail:   profile.user.email,
        haulerName:    profile.user.name,
        buyerCompany,
        loads:         parsed.data.loads,
        rateCents:     parsed.data.haulRateCents,
        scheduledDate: scheduledStr,
        orderId:       order.id,
        dashboardPath: "/dashboard/driver/haul-orders",
      }).catch(console.error);
    }
  } else if (parsed.data.carrierId) {
    const profile = await prisma.carrierProfile.findUnique({
      where:  { id: parsed.data.carrierId },
      select: { user: { select: { email: true, name: true } } },
    });
    if (profile?.user.email) {
      sendHaulRequestToHauler({
        haulerEmail:   profile.user.email,
        haulerName:    profile.user.name,
        buyerCompany,
        loads:         parsed.data.loads,
        rateCents:     parsed.data.haulRateCents,
        scheduledDate: scheduledStr,
        orderId:       order.id,
        dashboardPath: "/dashboard/buyer/haul-orders",
      }).catch(console.error);
    }
  }

  return NextResponse.json({ order, clientSecret }, { status: 201 });
}
