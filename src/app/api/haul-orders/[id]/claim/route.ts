import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { sendHaulClaimedToBuyer } from "@/lib/email";

// PATCH /api/haul-orders/[id]/claim
// Driver or carrier claims an open broadcast FCFS haul order
export async function PATCH(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  if (role !== "DRIVER" && role !== "CARRIER")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const order = await tx.haulOrder.findUnique({
        where:   { id: params.id },
        include: { buyer: { select: { email: true, name: true } } },
      });
      if (!order) throw new Error("Order not found");
      if (order.status !== "PENDING") throw new Error("Order is no longer available");
      if (order.driverId || order.carrierId) throw new Error("Order has already been claimed");
      if (order.expiresAt && order.expiresAt < new Date()) throw new Error("Order has expired");

      if (role === "DRIVER") {
        const profile = await tx.driverProfile.findUnique({ where: { userId: session.user.id } });
        if (!profile) throw new Error("Driver profile not found. Complete your profile first.");
        if (!profile.docsVerified) throw new Error("Your documents must be verified before accepting orders");
        return tx.haulOrder.update({
          where: { id: params.id },
          data:  { driverId: profile.id, status: "CONFIRMED" },
          include: { buyer: { select: { email: true, name: true } } },
        });
      } else {
        const profile = await tx.carrierProfile.findUnique({ where: { userId: session.user.id } });
        if (!profile) throw new Error("Carrier profile not found. Complete your profile first.");
        return tx.haulOrder.update({
          where: { id: params.id },
          data:  { carrierId: profile.id, status: "CONFIRMED" },
          include: { buyer: { select: { email: true, name: true } } },
        });
      }
    });

    // Notify buyer that their broadcast was claimed
    const buyerEmail = (updated as typeof updated & { buyer: { email: string; name: string | null } }).buyer?.email;
    const buyerName  = (updated as typeof updated & { buyer: { email: string; name: string | null } }).buyer?.name;
    if (buyerEmail) {
      const scheduledStr = new Date(updated.scheduledDate).toLocaleDateString("en-US", {
        weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
      });
      sendHaulClaimedToBuyer({
        buyerEmail,
        buyerName,
        haulerName: session.user.name ?? null,
        loads:      updated.loads,
        scheduledDate: scheduledStr,
        orderId:    updated.id,
      }).catch(console.error);
    }

    return NextResponse.json({ order: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to claim order";
    const status = msg === "Order not found" ? 404
      : (msg.includes("already been claimed") || msg.includes("expired")) ? 409
      : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
