import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { isBuyerRole } from "@/types";
import { NextResponse } from "next/server";

// PATCH /api/haul-orders/[id]/complete
// Buyer marks haul as complete and captures the manual-hold deposit via Stripe
export async function PATCH(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isBuyerRole(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const order = await prisma.haulOrder.findUnique({ where: { id: params.id } });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (order.buyerUserId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (order.status !== "CONFIRMED" && order.status !== "ACTIVE") {
    return NextResponse.json(
      { error: "Order cannot be completed in its current state" },
      { status: 409 }
    );
  }

  // Capture the Stripe manual-hold payment intent (charges the deposit to the buyer's card)
  if (order.stripePaymentIntentId) {
    try {
      await stripe.paymentIntents.capture(order.stripePaymentIntentId);
    } catch (err) {
      console.error("[haul-complete] Stripe capture failed:", err);
      return NextResponse.json({ error: "Payment capture failed. Please try again." }, { status: 502 });
    }
  }

  const updated = await prisma.haulOrder.update({
    where: { id: params.id },
    data:  { status: "COMPLETED" },
  });

  return NextResponse.json({ order: updated });
}
