import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function LoadHistoryPage() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== "PIT_OWNER" && session.user.role !== "ADMIN")) {
    redirect("/dashboard");
  }

  const pits = await prisma.pit.findMany({
    where:  { ownerId: session.user.id },
    select: { id: true },
  });
  const pitIds = pits.map((p) => p.id);

  // Fetch haul orders for this pit owner that have load session activity
  const haulOrders = pitIds.length > 0
    ? await prisma.haulOrder.findMany({
        where: {
          pitId:  { in: pitIds },
          status: { in: ["CONFIRMED", "ACTIVE", "COMPLETED"] },
          pitOwnerLoadLogs: { some: {} },
        },
        orderBy: { scheduledDate: "desc" },
        take: 100,
        select: {
          id:                   true,
          scheduledDate:        true,
          loads:                true,
          actualLoads:          true,
          haulRateCents:        true,
          afterHoursFeeCents:   true,
          status:               true,
          pitSessionStartedAt:  true,
          pitSessionEndedAt:    true,
          cobDueAt:             true,
          pit:     { select: { name: true, state: true } },
          buyer:   { select: { name: true, company: true } },
          driver:  { select: { user: { select: { name: true } } } },
          carrier: { select: { companyName: true, user: { select: { name: true } } } },
          pitOwnerLoadLogs: {
            orderBy: { loggedAt: "asc" },
            select:  { id: true, loggedAt: true },
          },
        },
      })
    : [];

  const totalLogs = haulOrders.reduce((s, o) => s + o.pitOwnerLoadLogs.length, 0);

  function haulerName(o: typeof haulOrders[0]): string {
    if (o.carrier) return o.carrier.companyName ?? o.carrier.user.name ?? "Carrier";
    if (o.driver)  return o.driver.user.name ?? "Driver";
    return "—";
  }

  function buyerLabel(o: typeof haulOrders[0]): string {
    return o.buyer.company ?? o.buyer.name ?? "Buyer";
  }

  function sessionLoads(o: typeof haulOrders[0]): number {
    if (!o.pitSessionStartedAt) return o.pitOwnerLoadLogs.length;
    const start = new Date(o.pitSessionStartedAt);
    return o.pitOwnerLoadLogs.filter((l) => new Date(l.loggedAt) >= start).length;
  }

  const statusColors: Record<string, string> = {
    CONFIRMED: "bg-green-100 text-green-700",
    ACTIVE:    "bg-blue-100 text-blue-700",
    COMPLETED: "bg-gray-100 text-gray-500",
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard/pit-owner" className="text-amber-600 text-sm font-medium">← Dashboard</Link>
        <span className="font-black text-black text-lg">Got Dirt?</span>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Load Log History</h1>
          <span className="text-sm text-gray-500">{totalLogs} total taps · {haulOrders.length} orders</span>
        </div>

        {haulOrders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-400">
            <p className="text-sm">No load sessions recorded yet.</p>
            <p className="text-xs mt-1">Logs appear here after you start a load session for an active haul order.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {haulOrders.map((order) => {
              const count    = sessionLoads(order);
              const hauler   = haulerName(order);
              const buyer    = buyerLabel(order);
              const estLoads = order.loads;
              const baseCents  = (order.actualLoads ?? count) * order.haulRateCents;
              const totalCents = baseCents + (order.afterHoursFeeCents ?? 0);

              return (
                <div key={order.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                  {/* Order header */}
                  <div className="px-5 py-4 flex items-start justify-between gap-4 border-b border-gray-100">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-gray-900">{order.pit?.name ?? "Pit"}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${statusColors[order.status] ?? "bg-gray-100 text-gray-500"}`}>
                          {order.status}
                        </span>
                        {(order.afterHoursFeeCents ?? 0) > 0 && (
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">
                            After-Hours Fee
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">{buyer} · {hauler}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(order.scheduledDate).toLocaleDateString("en-US", {
                          weekday: "short", month: "short", day: "numeric", year: "numeric",
                        })}
                      </p>
                    </div>

                    <div className="text-right shrink-0 space-y-0.5">
                      <p className="text-2xl font-black text-gray-900">{count}</p>
                      <p className="text-xs text-gray-400">/ {estLoads} est.</p>
                      {totalCents > 0 && (
                        <p className="text-sm font-bold text-green-700">
                          ${(totalCents / 100).toFixed(2)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Session timing */}
                  <div className="px-5 py-3 bg-gray-50 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-500 border-b border-gray-100">
                    <div>
                      <span className="font-semibold text-gray-700">Session started: </span>
                      {order.pitSessionStartedAt
                        ? new Date(order.pitSessionStartedAt).toLocaleString("en-US", {
                            month: "short", day: "numeric",
                            hour: "numeric", minute: "2-digit",
                          })
                        : "—"}
                    </div>
                    <div>
                      <span className="font-semibold text-gray-700">Session ended: </span>
                      {order.pitSessionEndedAt
                        ? new Date(order.pitSessionEndedAt).toLocaleString("en-US", {
                            month: "short", day: "numeric",
                            hour: "numeric", minute: "2-digit",
                          })
                        : "—"}
                    </div>
                    <div>
                      <span className="font-semibold text-gray-700">COB deadline: </span>
                      {order.cobDueAt
                        ? new Date(order.cobDueAt).toLocaleString("en-US", {
                            hour: "numeric", minute: "2-digit",
                          })
                        : "5:30 PM local"}
                    </div>
                    {(order.afterHoursFeeCents ?? 0) > 0 && (
                      <div className="text-red-600 font-semibold">
                        After-hours fee: +${((order.afterHoursFeeCents ?? 0) / 100).toFixed(2)}
                      </div>
                    )}
                  </div>

                  {/* Individual tap log */}
                  {order.pitOwnerLoadLogs.length > 0 && (
                    <div className="px-5 py-3">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                        Tap Log — {order.pitOwnerLoadLogs.length} entries
                      </p>
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                        {order.pitOwnerLoadLogs.map((log, i) => {
                          const inSession =
                            !order.pitSessionStartedAt ||
                            new Date(log.loggedAt) >= new Date(order.pitSessionStartedAt);
                          return (
                            <div
                              key={log.id}
                              className={`text-center rounded-lg px-2 py-1.5 text-xs ${
                                inSession
                                  ? "bg-amber-50 text-amber-800 font-semibold"
                                  : "bg-gray-50 text-gray-400"
                              }`}
                              title={new Date(log.loggedAt).toLocaleString()}
                            >
                              <div className="font-bold">#{i + 1}</div>
                              <div className="text-[10px] mt-0.5 leading-tight">
                                {new Date(log.loggedAt).toLocaleTimeString("en-US", {
                                  hour: "numeric", minute: "2-digit",
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
