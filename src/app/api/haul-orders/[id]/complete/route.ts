import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { isBuyerRole } from "@/types";
import { NextResponse } from "next/server";
import { sendHaulCompletedToBuyer, sendHaulPayoutToHauler, sendPaymentReceivedPitOwner } from "@/lib/email";
import { z } from "zod";

const schema = z.object({
  actualLoads: z.number().int().min(0),
});

// PATCH /api/haul-orders/[id]/complete
// Buyer marks haul complete with the actual loads delivered.
// Charges exactly actualLoads × haulRateCents — not the original estimate.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isBuyerRole(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { actualLoads } = parsed.data;

  try {
    const order = await prisma.haulOrder.findUnique({
      where:   { id: params.id },
      include: {
        buyer:   { select: { stripeCustomerId: true, email: true, name: true, company: true } },
        driver:  { include: { user: { select: { stripeAccountId: true, email: true, name: true } } } },
        carrier: { include: { user: { select: { stripeAccountId: true, email: true, name: true } } } },
        pit:     { select: { name: true, owner: { select: { stripeAccountId: true, email: true, name: true } } } },
      },
    });
    if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (order.buyerUserId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (order.status !== "CONFIRMED" && order.status !== "ACTIVE") {
      return NextResponse.json({ error: "Order cannot be completed in its current state" }, { status: 409 });
    }

    // For buyer-op (self-haul), haulRateCents is the truck cost-tracking rate — NOT billed via Stripe.
    // Only pit materialCents is billable. For direct/broadcast hauls, both portions are billable.
    const isBuyerOp      = order.buyerOperating;
    const haulCents      = actualLoads * order.haulRateCents;
    const materialCents  = actualLoads * (order.pitMaterialRateCents ?? 0);
    // chargeableCents is what actually gets captured from the buyer's card
    const chargeableCents = isBuyerOp ? materialCents : haulCents + materialCents;

    const settings = await prisma.platformSettings.findUnique({ where: { id: "singleton" } });
    const haulFeePercent     = isBuyerOp ? 0 : (settings?.haulFeePercent ?? 10.0);
    const matFeePercent      = settings?.feePercent ?? 8.0;

    const haulPlatformFee    = Math.round(haulCents     * haulFeePercent / 100);
    const matPlatformFee     = Math.round(materialCents * matFeePercent  / 100);
    const actualPlatformFee  = haulPlatformFee + matPlatformFee;
    const actualHaulerPayout = isBuyerOp ? 0 : haulCents - haulPlatformFee;
    const pitMaterialPayout  = materialCents - matPlatformFee;

    const STRIPE_MIN_CENTS = 50;

    // ── Stripe charge logic ──────────────────────────────────────────────────
    // The authorization (depositHoldCents) was set to the full estimated amount at order creation,
    // so chargeableCents ≤ depositHoldCents in the normal case (partial capture releases the rest).
    // An overage PI is only needed when actual loads exceed the estimate.
    if (order.stripePaymentIntentId && chargeableCents > 0) {
      const captureAmount = Math.max(chargeableCents, STRIPE_MIN_CENTS);

      const safeCapture = async (piId: string, opts?: { amount_to_capture: number }) => {
        try {
          return await stripe.paymentIntents.capture(piId, opts);
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          // Already captured = money already collected on a previous attempt; treat as success
          if (msg.toLowerCase().includes("already been captured")) {
            console.log("[complete] PI already captured — treating as success:", piId);
            return null;
          }
          throw e;
        }
      };

      if (chargeableCents <= order.depositHoldCents) {
        // Typical path: capture exactly what is owed (≤ authorized amount)
        await safeCapture(order.stripePaymentIntentId, { amount_to_capture: captureAmount });
      } else {
        // Overage: actual loads exceeded estimate — capture full authorization, charge extra
        await safeCapture(order.stripePaymentIntentId);

        const overageCents = chargeableCents - order.depositHoldCents;
        if (overageCents >= STRIPE_MIN_CENTS && order.buyer.stripeCustomerId) {
          // Retrieve the PI to get the exact payment method the buyer originally used
          const depositPI = await stripe.paymentIntents.retrieve(order.stripePaymentIntentId);
          const pmId = typeof depositPI.payment_method === "string"
            ? depositPI.payment_method
            : depositPI.payment_method?.id ?? null;

          if (pmId) {
            await stripe.paymentIntents.create({
              amount:         overageCents,
              currency:       "usd",
              customer:       order.buyer.stripeCustomerId,
              payment_method: pmId,
              confirm:        true,
              off_session:    true,
              automatic_payment_methods: { enabled: true, allow_redirects: "never" },
              description:    `Got Dirt? — Extra loads (${actualLoads - order.loads} over estimate) — Order ${order.id}`,
              metadata:       { haulOrderId: order.id, type: "overage" },
            });
          }
        }
      }
    } else if (order.stripePaymentIntentId && chargeableCents === 0) {
      await stripe.paymentIntents.cancel(order.stripePaymentIntentId);
    }

    const updated = await prisma.haulOrder.update({
      where: { id: params.id },
      data:  {
        status:                 "COMPLETED",
        actualLoads,
        platformFeePercent:     haulFeePercent,
        platformFeeCents:       actualPlatformFee,
        haulerPayoutCents:      actualHaulerPayout,
        pitMaterialFeeCents:    matPlatformFee,
        pitMaterialPayoutCents: pitMaterialPayout,
      },
    });

    // ── Stripe payouts ────────────────────────────────────────────────────────
    // Transfer to pit owner and hauler using their Stripe Connect accounts.
    // Fire-and-forget: failures are logged but don't block the buyer's response.
    const pitOwnerAccountId = order.pit?.owner?.stripeAccountId ?? null;
    const haulerAccountId   = order.driver?.user.stripeAccountId
                           ?? order.carrier?.user.stripeAccountId
                           ?? null;

    if (pitMaterialPayout > 0 && pitOwnerAccountId) {
      stripe.transfers.create({
        amount:         pitMaterialPayout,
        currency:       "usd",
        destination:    pitOwnerAccountId,
        transfer_group: order.id,
        metadata:       { haulOrderId: order.id, type: "pit_material" },
        description:    `Got Dirt? — Pit material payout for Order ${order.id}`,
      }).then(() => {
        const ownerEmail = order.pit?.owner?.email;
        const ownerName  = order.pit?.owner?.name ?? null;
        const pitNameStr = order.pit?.name ?? "your pit";
        if (ownerEmail) {
          sendPaymentReceivedPitOwner({
            ownerEmail,
            ownerName,
            pitName:      pitNameStr,
            payoutCents:  pitMaterialPayout,
            invoiceNumber: `ORD-${order.id.slice(0, 8).toUpperCase()}`,
          }).catch(console.error);
        }
      }).catch((err: unknown) => console.error("[complete] pit owner transfer failed:", err));
    }

    if (actualHaulerPayout > 0 && haulerAccountId) {
      stripe.transfers.create({
        amount:         actualHaulerPayout,
        currency:       "usd",
        destination:    haulerAccountId,
        transfer_group: order.id,
        metadata:       { haulOrderId: order.id, type: "haul" },
        description:    `Got Dirt? — Haul payout for Order ${order.id}`,
      }).then(() => {
        const haulerEmail = order.driver?.user.email ?? order.carrier?.user.email;
        const haulerName  = order.driver?.user.name  ?? order.carrier?.user.name ?? null;
        const buyerCompany = order.buyer.company ?? order.buyer.name ?? null;
        if (haulerEmail) {
          sendHaulPayoutToHauler({
            haulerEmail,
            haulerName,
            buyerCompany,
            actualLoads,
            payoutCents: actualHaulerPayout,
            orderId:     order.id,
          }).catch(console.error);
        }
      }).catch((err: unknown) => console.error("[complete] hauler transfer failed:", err));
    }

    // Notify the buyer that their card has been charged and payouts are on the way
    if (order.buyer.email) {
      const haulerName  = order.driver?.user.name ?? order.carrier?.user.name ?? null;
      const pitNameStr  = order.pit?.name ?? "the pit";
      const buyerName   = order.buyer.name ?? null;
      sendHaulCompletedToBuyer({
        buyerEmail:        order.buyer.email,
        buyerName,
        haulerName,
        pitName:           pitNameStr,
        actualLoads,
        haulRateCents:     isBuyerOp ? 0 : order.haulRateCents,
        materialRateCents: order.pitMaterialRateCents ?? 0,
        totalCents:        chargeableCents,
        orderId:           order.id,
      }).catch(console.error);
    }

    return NextResponse.json({
      order:                  updated,
      actualLoads,
      chargeableCents,
      platformFeeCents:       actualPlatformFee,
      haulerPayoutCents:      actualHaulerPayout,
      pitMaterialPayoutCents: pitMaterialPayout,
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[complete] unhandled error:", msg);
    return NextResponse.json({ error: msg.slice(0, 300) }, { status: 500 });
  }
}
