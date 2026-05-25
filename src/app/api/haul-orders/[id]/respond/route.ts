import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";
import { sendHaulConfirmedToBuyer, sendHaulDeniedToBuyer } from "@/lib/email";
import { getHaulerConflicts } from "@/lib/hauler-overlap";

const schema = z.object({
  action: z.enum(["CONFIRM", "DENY"]),
});

// PATCH /api/haul-orders/[id]/respond — driver or carrier accepts/denies a direct request
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  if (role !== "DRIVER" && role !== "CARRIER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const order = await prisma.haulOrder.findUnique({
    where:   { id: params.id },
    include: {
      driver:  { select: { userId: true } },
      carrier: { select: { userId: true } },
      buyer:   { select: { email: true, name: true } },
    },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isDriver  = role === "DRIVER"  && order.driver?.userId  === session.user.id;
  const isCarrier = role === "CARRIER" && order.carrier?.userId === session.user.id;
  if (!isDriver && !isCarrier) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (order.status !== "PENDING") {
    return NextResponse.json({ error: "Order is no longer pending" }, { status: 409 });
  }

  if (order.expiresAt && order.expiresAt < new Date()) {
    return NextResponse.json({ error: "This order has expired" }, { status: 410 });
  }

  // Overlap check — only when confirming
  if (parsed.data.action === "CONFIRM") {
    if (isDriver && order.driverId) {
      const conflicts = await getHaulerConflicts(
        "driver", order.driverId, order.scheduledDate,
        order.buyerUserId, order.projectId ?? null,
      );
      if (conflicts.length > 0) {
        return NextResponse.json({
          error: "You already have a confirmed order within 4 hours of this time. Cancel or complete it first, or contact the buyer to reschedule.",
        }, { status: 409 });
      }
    }
    if (isCarrier && order.carrierId) {
      const conflicts = await getHaulerConflicts(
        "carrier", order.carrierId, order.scheduledDate,
        order.buyerUserId, order.projectId ?? null,
      );
      if (conflicts.length > 0) {
        return NextResponse.json({
          error: "Your company already has a confirmed order within 4 hours of this time. Resolve the conflict before accepting.",
        }, { status: 409 });
      }
    }
  }

  const newStatus = parsed.data.action === "CONFIRM" ? "CONFIRMED" : "DENIED";
  const updated = await prisma.haulOrder.update({
    where: { id: params.id },
    data:  { status: newStatus },
  });

  // Notify buyer
  const haulerName = session.user.name ?? null;
  const scheduledStr = new Date(order.scheduledDate).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });

  if (order.buyer.email) {
    if (newStatus === "CONFIRMED") {
      sendHaulConfirmedToBuyer({
        buyerEmail:    order.buyer.email,
        buyerName:     order.buyer.name,
        haulerName,
        loads:         order.loads,
        scheduledDate: scheduledStr,
        orderId:       order.id,
      }).catch(console.error);
    } else {
      sendHaulDeniedToBuyer({
        buyerEmail:    order.buyer.email,
        buyerName:     order.buyer.name,
        haulerName,
        scheduledDate: scheduledStr,
      }).catch(console.error);
    }
  }

  return NextResponse.json({ order: updated });
}
