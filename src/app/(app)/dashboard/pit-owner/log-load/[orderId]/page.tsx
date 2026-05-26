import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import LogLoadPanel from "./LogLoadPanel";

interface Props { params: { orderId: string } }

export default async function LogLoadPage({ params }: Props) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== "PIT_OWNER" && session.user.role !== "ADMIN")) {
    redirect("/dashboard");
  }

  const order = await prisma.haulOrder.findUnique({
    where:  { id: params.orderId },
    select: {
      id:                  true,
      loads:               true,
      scheduledDate:       true,
      pitSessionActive:    true,
      pitSessionStartedAt: true,
      status:              true,
      pit:     { select: { name: true, state: true, ownerId: true } },
      buyer:   { select: { name: true, company: true } },
      driver:  { select: { user: { select: { name: true } } } },
      carrier: { select: { companyName: true, user: { select: { name: true } } } },
    },
  });

  if (!order) notFound();

  // Only allow the pit owner who owns this pit (or admin)
  if (
    session.user.role !== "ADMIN" &&
    order.pit?.ownerId !== session.user.id
  ) {
    redirect("/dashboard/pit-owner");
  }

  // Redirect away if no active session
  if (!order.pitSessionActive) {
    redirect("/dashboard/pit-owner/active-orders");
  }

  // Fetch initial counts
  const [pitCount, driverCount] = await Promise.all([
    prisma.pitOwnerLoadLog.count({
      where: {
        haulOrderId: order.id,
        ...(order.pitSessionStartedAt ? { loggedAt: { gte: order.pitSessionStartedAt } } : {}),
      },
    }),
    prisma.driverLoadLog.count({ where: { haulOrderId: order.id } }),
  ]);

  const haulerName = order.carrier
    ? order.carrier.companyName ?? order.carrier.user.name ?? "Carrier"
    : order.driver?.user.name ?? "Driver";

  const buyerName = order.buyer.company ?? order.buyer.name ?? "Buyer";

  const scheduledDateStr = new Date(order.scheduledDate).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });

  return (
    <LogLoadPanel
      orderId={order.id}
      pitName={order.pit?.name ?? "Pit"}
      buyerName={buyerName}
      haulerName={haulerName}
      estimatedLoads={order.loads}
      scheduledDateStr={scheduledDateStr}
      initialCount={pitCount}
      initialDriverCount={driverCount}
      sessionStartedAt={order.pitSessionStartedAt?.toISOString() ?? null}
    />
  );
}
