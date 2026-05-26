import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isBuyerRole } from "@/types";
import { sendHaulRequestToHauler, sendHaulBroadcast } from "@/lib/email";
import { filterAvailableHaulers, getHaulerConflicts } from "@/lib/hauler-overlap";

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

  // For broadcast orders, pre-fetch and filter available haulers BEFORE creating
  // the order. If nobody is available at the requested time, block immediately.
  // Results are stored here and reused for the email step to avoid a second query.
  let broadcastDriverEmails: string[] = [];
  let broadcastCarrierEmails: string[] = [];

  if (broadcast && !isBuyerOp) {
    const broadcastDate      = new Date(orderData.scheduledDate);
    const broadcastProjectId = orderData.projectId ?? null;

    const [allDrivers, allCarriers] = await Promise.all([
      prisma.driverProfile.findMany({
        where:  { profilePublic: true, docsVerified: true },
        select: { id: true, user: { select: { email: true } } },
      }),
      pitRateBroadcast
        ? prisma.carrierProfile.findMany({
            where:  { profilePublic: true },
            select: { id: true, user: { select: { email: true } } },
          })
        : Promise.resolve([]),
    ]);

    const [availDriverIds, availCarrierIds] = await Promise.all([
      filterAvailableHaulers("driver",  allDrivers.map((d) => d.id),  broadcastDate, session.user.id, broadcastProjectId),
      allCarriers.length > 0
        ? filterAvailableHaulers("carrier", allCarriers.map((c) => c.id), broadcastDate, session.user.id, broadcastProjectId)
        : Promise.resolve([]),
    ]);

    const availDriverSet  = new Set(availDriverIds);
    const availCarrierSet = new Set(availCarrierIds);

    broadcastDriverEmails  = allDrivers.filter((d) => availDriverSet.has(d.id)).map((d) => d.user.email).filter(Boolean) as string[];
    broadcastCarrierEmails = allCarriers.filter((c) => availCarrierSet.has(c.id)).map((c) => c.user.email).filter(Boolean) as string[];

    if (broadcastDriverEmails.length === 0 && broadcastCarrierEmails.length === 0) {
      return NextResponse.json(
        { error: "No haulers are available at the selected time. All verified drivers and carriers have a confirmed order within 4 hours of your scheduled time. Please choose a different time." },
        { status: 409 },
      );
    }
  }

  // For direct requests, verify the selected hauler has no conflicting orders
  // before creating the order. Return 409 so the form can show the error.
  if (!isBuyerOp && !broadcast && (orderData.driverId || orderData.carrierId)) {
    const scheduledDate   = new Date(orderData.scheduledDate);
    const newProjectId    = orderData.projectId ?? null;

    if (orderData.driverId) {
      const conflicts = await getHaulerConflicts(
        "driver", orderData.driverId, scheduledDate, session.user.id, newProjectId,
      );
      if (conflicts.length > 0) {
        return NextResponse.json(
          { error: "The driver you selected is unavailable during the selected time. Please choose a different driver or adjust the scheduled time." },
          { status: 409 },
        );
      }
    }

    if (orderData.carrierId) {
      const conflicts = await getHaulerConflicts(
        "carrier", orderData.carrierId, scheduledDate, session.user.id, newProjectId,
      );
      if (conflicts.length > 0) {
        return NextResponse.json(
          { error: "The carrier you selected is unavailable during the selected time. Please choose a different carrier or adjust the scheduled time." },
          { status: 409 },
        );
      }
    }
  }

  const haulFeePercent    = isBuyerOp ? 0 : (platformSettings?.haulFeePercent ?? 10.0);
  const matFeePercent     = platformSettings?.feePercent ?? 8.0;

  // Lock in the pit's material rate at order time so the charge is accurate
  // regardless of future pit rate changes.
  // Always fetch for pit-linked orders — buyer-op still owes the pit for material.
  let pitMaterialRateCents = 0;
  if (orderData.pitId) {
    const pit = await prisma.pit.findUnique({
      where:  { id: orderData.pitId },
      select: { borrowRateCents: true },
    });
    pitMaterialRateCents = pit?.borrowRateCents ?? 0;
  }

  const haulTotal           = resolvedHaulRate * orderData.loads;
  const materialTotal       = pitMaterialRateCents * orderData.loads;
  const totalEstimatedCents = haulTotal + materialTotal;
  // For buyer-op orders the truck cost is self-reported (not billed through Got Dirt).
  // The deposit only needs to cover the pit material charge.
  const depositHoldCents = isBuyerOp
    ? Math.round(materialTotal * 0.25)
    : Math.round(totalEstimatedCents * 0.25);

  const haulPlatformFee       = isBuyerOp ? 0 : Math.round(haulTotal * haulFeePercent / 100);
  const haulerPayoutCents     = isBuyerOp ? 0 : haulTotal - haulPlatformFee;
  const matPlatformFee        = Math.round(materialTotal * matFeePercent / 100);
  const pitMaterialPayout     = materialTotal - matPlatformFee;

  const order = await prisma.haulOrder.create({
    data: {
      buyerUserId:  session.user.id,
      ...orderData,
      haulRateCents:         resolvedHaulRate,
      totalEstimatedCents,
      depositHoldCents,
      scheduledDate:         new Date(orderData.scheduledDate),
      expiresAt:             orderData.expiresAt ? new Date(orderData.expiresAt) : undefined,
      status:                isBuyerOp ? "CONFIRMED" : undefined,
      broadcast,
      pitRateBroadcast,
      platformFeePercent:    haulFeePercent,
      platformFeeCents:      haulPlatformFee,
      haulerPayoutCents,
      pitMaterialRateCents,
      pitMaterialFeeCents:   matPlatformFee,
      pitMaterialPayoutCents: pitMaterialPayout,
    },
  });

  // Create a Stripe hold whenever there is a deposit to collect.
  // Buyer-op orders skip the haul charge but still owe the pit for material.
  let clientSecret: string | null = null;
  if (depositHoldCents > 0 && customerId) {
    const piDescription = isBuyerOp
      ? `Got Dirt? — Pit material deposit hold (${parsed.data.loads} load${parsed.data.loads !== 1 ? "s" : ""})`
      : `Got Dirt? — Haul deposit hold (${parsed.data.loads} load${parsed.data.loads !== 1 ? "s" : ""})`;
    const pi = await stripe.paymentIntents.create({
      amount:         depositHoldCents,
      currency:       "usd",
      customer:       customerId,
      capture_method: "manual",
      metadata: {
        haulOrderId:  order.id,
        orderedBy:    session.user.id,
      },
      description: piDescription,
    });
    await prisma.haulOrder.update({
      where: { id: order.id },
      data:  { stripePaymentIntentId: pi.id },
    });
    clientSecret = pi.client_secret;
  }

  // Buyer-op orders need no hauler notifications — skip to response
  if (isBuyerOp) {
    return NextResponse.json({ order, clientSecret }, { status: 201 });
  }

  // Send notifications
  const scheduledStr = new Date(parsed.data.scheduledDate).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
  const buyerCompany = buyer?.company ?? buyer?.name ?? null;

  if (broadcast) {
    // Email lists were pre-filtered above before order creation
    const emails = [...broadcastDriverEmails, ...broadcastCarrierEmails];
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
