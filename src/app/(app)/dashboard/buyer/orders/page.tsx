import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import CloseOrderButton from "./CloseOrderButton";
import ChargeOrderButton from "./ChargeOrderButton";
import CompleteHaulButton from "../haul-orders/CompleteHaulButton";

export const metadata = { title: "Order History — Got Dirt?" };

const STATUS_LABELS: Record<string, string> = {
  ACTIVE:    "Active",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

// Map HaulOrder statuses to the three display buckets
const HAUL_TO_DISPLAY: Record<string, string> = {
  PENDING:   "ACTIVE",
  CONFIRMED: "ACTIVE",
  ACTIVE:    "ACTIVE",
  COMPLETED: "COMPLETED",
  DENIED:    "CANCELLED",
  CANCELLED: "CANCELLED",
};

const haulStatusColors: Record<string, string> = {
  PENDING:   "bg-amber-100 text-amber-700",
  CONFIRMED: "bg-green-100 text-green-700",
  DENIED:    "bg-red-100 text-red-600",
  ACTIVE:    "bg-blue-100 text-blue-700",
  COMPLETED: "bg-gray-100 text-gray-500",
  CANCELLED: "bg-gray-100 text-gray-400",
};

export default async function OrderHistoryPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const filterStatus = searchParams.status?.toUpperCase();
  const validStatuses = ["ACTIVE", "COMPLETED", "CANCELLED"];
  const activeFilter = validStatuses.includes(filterStatus ?? "") ? filterStatus : undefined;

  // Status filters for material Orders
  const orderStatusFilter = activeFilter
    ? { status: activeFilter as "ACTIVE" | "COMPLETED" | "CANCELLED" }
    : {};

  // Status filters for HaulOrders based on display bucket
  const haulActiveStatuses  = ["PENDING", "CONFIRMED", "ACTIVE"];
  const haulCompletedStatuses = ["COMPLETED"];
  const haulCancelledStatuses = ["DENIED", "CANCELLED"];
  const haulStatusFilter = activeFilter === "ACTIVE"    ? haulActiveStatuses
    : activeFilter === "COMPLETED"  ? haulCompletedStatuses
    : activeFilter === "CANCELLED"  ? haulCancelledStatuses
    : [...haulActiveStatuses, ...haulCompletedStatuses, ...haulCancelledStatuses];

  const [orders, haulOrders] = await Promise.all([
    prisma.order.findMany({
      where:   { buyerUserId: session.user.id, ...orderStatusFilter },
      include: {
        pit:     { select: { name: true, address: true, state: true } },
        project: { select: { name: true } },
        _count:  { select: { loadEvents: true } },
        loadEvents:  { select: { materialType: true }, where: { verified: true } },
        settlements: { select: { grossAmountCents: true, verifiedLoadCount: true, status: true } },
      },
      orderBy: { date: "desc" },
    }),
    prisma.haulOrder.findMany({
      where: {
        buyerUserId: session.user.id,
        status: { in: haulStatusFilter as ("PENDING" | "CONFIRMED" | "ACTIVE" | "COMPLETED" | "DENIED" | "CANCELLED")[] },
      },
      include: {
        driver:  { include: { user: { select: { name: true, phone: true } } } },
        carrier: { select: { companyName: true, user: { select: { name: true, phone: true } } } },
        pit:     { select: { name: true, state: true } },
        project: { select: { name: true } },
        amendments: {
          where:   { status: { in: ["PENDING", "APPROVED"] } },
          orderBy: { createdAt: "desc" },
          take:    1,
          select:  { status: true, requestedLoads: true, haulerApproved: true, pitOwnerApproved: true },
        },
      },
      orderBy: { scheduledDate: "desc" },
    }),
  ]);

  const totalSpent = orders.flatMap((o) => o.settlements)
    .filter((s) => s.status === "PROCESSED")
    .reduce((sum, s) => sum + s.grossAmountCents, 0);

  const totalHaulCharged = haulOrders
    .filter((o) => o.status === "COMPLETED")
    .reduce((sum, o) => sum + (o.actualLoads != null ? o.actualLoads * o.haulRateCents : o.totalEstimatedCents), 0);

  const totalLoads = orders.reduce((sum, o) => sum + o._count.loadEvents, 0);
  const totalItems = orders.length + haulOrders.length;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard/buyer" className="text-amber-600 hover:text-amber-700 text-sm font-medium">← Dashboard</Link>
        <span className="text-gray-300">|</span>
        <Link href="/" className="font-black text-black text-lg">Got Dirt?</Link>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h1 className="text-2xl font-bold text-gray-900">
            {activeFilter ? `${STATUS_LABELS[activeFilter]} Orders` : "Order History"}
          </h1>
          <div className="flex gap-2">
            <Link href="/dashboard/buyer/orders"
              className={`text-xs px-3 py-1.5 rounded-full font-semibold transition-colors ${!activeFilter ? "bg-gray-900 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-gray-400"}`}>
              All
            </Link>
            {["ACTIVE", "COMPLETED", "CANCELLED"].map((s) => (
              <Link key={s} href={`/dashboard/buyer/orders?status=${s}`}
                className={`text-xs px-3 py-1.5 rounded-full font-semibold transition-colors ${activeFilter === s ? "bg-gray-900 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-gray-400"}`}>
                {STATUS_LABELS[s]}
              </Link>
            ))}
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total Orders",     value: totalItems },
            { label: "Pit Loads",        value: totalLoads },
            { label: "Total Spent",      value: `$${((totalSpent + totalHaulCharged) / 100).toFixed(2)}` },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl border border-gray-200 p-5 text-center">
              <p className="text-2xl font-black text-gray-900">{s.value}</p>
              <p className="text-sm text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {totalItems === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <p className="text-gray-500 font-medium mb-2">No orders yet</p>
            <p className="text-sm text-gray-400 mb-4">Find a pit and place your first order.</p>
            <Link href="/map" className="bg-amber-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-amber-700">
              Find Pits →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">

            {/* ── Haul Orders ─────────────────────────────────────────────── */}
            {haulOrders.length > 0 && (
              <>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide pt-2">Haul Orders</h2>
                {haulOrders.map((o) => {
                  const haulerName = o.carrier?.companyName ?? o.carrier?.user.name
                    ?? o.driver?.user.name
                    ?? ((!o.driverId && !o.carrierId) ? "Open Broadcast" : "Awaiting hauler");
                  const haulerType = o.carrier ? "3PL" : o.driver ? "Driver" : "Broadcast";
                  const canComplete = o.status === "CONFIRMED" || o.status === "ACTIVE";
                  const displayBucket = HAUL_TO_DISPLAY[o.status] ?? o.status;
                  const chargedCents = o.status === "COMPLETED" && o.actualLoads != null
                    ? o.actualLoads * o.haulRateCents
                    : o.totalEstimatedCents;

                  return (
                    <div key={o.id} className="bg-white rounded-2xl border border-gray-200 p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-gray-900">{haulerName}</p>
                            <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-semibold">Haul</span>
                            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{haulerType}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${haulStatusColors[o.status] ?? "bg-gray-100 text-gray-600"}`}>
                              {o.status}
                            </span>
                          </div>
                          {o.pit    && <p className="text-sm text-gray-500 mt-0.5">{o.pit.name} · {o.pit.state}</p>}
                          {o.project && <p className="text-xs text-gray-400">{o.project.name}</p>}
                          <p className="text-xs text-gray-400 mt-1">
                            {new Date(o.scheduledDate).toLocaleDateString("en-US", {
                              weekday: "short", month: "short", day: "numeric",
                              hour: "numeric", minute: "2-digit",
                            })}
                          </p>
                          {o.status === "CONFIRMED" && (o.driver?.user.phone ?? o.carrier?.user.phone) && (
                            <p className="text-xs text-gray-500 mt-1">
                              📞 {o.driver?.user.phone ?? o.carrier?.user.phone}
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-lg font-bold text-gray-900">${(chargedCents / 100).toFixed(2)}</p>
                          <p className="text-xs text-gray-400">
                            {o.status === "COMPLETED" && o.actualLoads != null
                              ? `${o.actualLoads} actual load${o.actualLoads !== 1 ? "s" : ""}`
                              : `${o.loads} est. load${o.loads !== 1 ? "s" : ""}`}
                          </p>
                        </div>
                      </div>

                      {/* Amendment badge */}
                      {o.amendments.length > 0 && canComplete && (
                        <div className="mt-2">
                          {o.amendments[0].status === "PENDING" && (
                            <span className="text-xs font-semibold text-amber-700">
                              ⏳ Amendment pending — {o.amendments[0].requestedLoads} loads
                            </span>
                          )}
                          {o.amendments[0].status === "APPROVED" && (
                            <span className="text-xs font-semibold text-green-700">
                              ✓ Amendment approved — {o.amendments[0].requestedLoads} loads
                            </span>
                          )}
                        </div>
                      )}

                      {canComplete && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <CompleteHaulButton
                            orderId={o.id}
                            estimatedLoads={o.loads}
                            haulRateCents={o.haulRateCents}
                            pitMaterialRateCents={o.pitMaterialRateCents}
                            createdAt={o.createdAt.toISOString()}
                          />
                        </div>
                      )}

                      {!canComplete && displayBucket === "ACTIVE" && (
                        <div className="mt-2 pt-2 border-t border-gray-100">
                          <Link href="/dashboard/buyer/haul-orders"
                            className="text-xs text-amber-600 hover:underline">
                            Manage this haul order →
                          </Link>
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}

            {/* ── Pit Material Orders ──────────────────────────────────────── */}
            {orders.length > 0 && (
              <>
                {haulOrders.length > 0 && (
                  <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide pt-2">Pit Orders</h2>
                )}
                {orders.map((order) => {
                  const spent = order.settlements
                    .filter((s) => s.status === "PROCESSED")
                    .reduce((sum, s) => sum + s.grossAmountCents, 0);
                  const settledLoadCount = order.settlements
                    .filter((s) => s.status === "PROCESSED")
                    .reduce((sum, s) => sum + s.verifiedLoadCount, 0);
                  const unchargedLoadCount = order._count.loadEvents - settledLoadCount;
                  const hasUnchargedLoads  = unchargedLoadCount > 0;
                  const materialCounts = order.loadEvents.reduce<Record<string, number>>((acc, e) => {
                    acc[e.materialType] = (acc[e.materialType] ?? 0) + 1;
                    return acc;
                  }, {});

                  const statusStyle: Record<string, string> = {
                    ACTIVE:    "bg-green-100 text-green-700",
                    COMPLETED: "bg-gray-100 text-gray-600",
                    CANCELLED: "bg-red-100 text-red-600",
                  };

                  return (
                    <div key={order.id} className={`bg-white rounded-2xl border p-5 ${hasUnchargedLoads && order.status === "COMPLETED" ? "border-amber-300" : "border-gray-200"}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-gray-900">{order.pit.name}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${statusStyle[order.status] ?? "bg-gray-100 text-gray-600"}`}>
                              {order.status}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                              (order as { orderType?: string }).orderType === "DUMP"
                                ? "bg-orange-100 text-orange-700"
                                : "bg-blue-100 text-blue-700"
                            }`}>
                              {(order as { orderType?: string }).orderType === "DUMP" ? "Drop-off" : "Pickup"}
                            </span>
                            {hasUnchargedLoads && (
                              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">Unpaid</span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500 mt-0.5">
                            {order.project.name} · {order.pit.address ? `${order.pit.address}, ` : ""}{order.pit.state}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {new Date(order.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                          </p>
                          {Object.keys(materialCounts).length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {Object.entries(materialCounts).map(([mat, cnt]) => (
                                <span key={mat} className="text-xs bg-stone-100 text-stone-700 border border-stone-200 px-2 py-0.5 rounded-full font-medium">
                                  {mat} × {cnt}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-lg font-bold text-gray-900">${(spent / 100).toFixed(2)}</p>
                          <p className="text-xs text-gray-400">{order._count.loadEvents} load{order._count.loadEvents !== 1 ? "s" : ""}</p>
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex gap-4 text-xs text-gray-500">
                          {order.settlements.length > 0 && (
                            <>
                              <span>{order.settlements.length} settlement{order.settlements.length !== 1 ? "s" : ""}</span>
                              <span>{order.settlements.filter((s) => s.status === "PROCESSED").length} processed</span>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {hasUnchargedLoads && (
                            <ChargeOrderButton orderId={order.id} loadCount={unchargedLoadCount} />
                          )}
                          {order.status === "ACTIVE" && (
                            <CloseOrderButton orderId={order.id} />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
