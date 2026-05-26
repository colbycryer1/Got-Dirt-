import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getPitOwnerLoadLogCounts, getDriverLoadLogCounts } from "@/lib/haul-load-log";
import RespondForm from "./RespondForm";

export const metadata = { title: "Haul Orders — Got Dirt?" };

const statusColors: Record<string, string> = {
  PENDING:   "bg-amber-100 text-amber-700",
  CONFIRMED: "bg-green-100 text-green-700",
  DENIED:    "bg-red-100 text-red-600",
  ACTIVE:    "bg-blue-100 text-blue-700",
  COMPLETED: "bg-gray-100 text-gray-500",
  CANCELLED: "bg-gray-100 text-gray-400",
};

function fmt(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export default async function DriverHaulOrdersPage({
  searchParams,
}: {
  searchParams: { respond?: string; action?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role !== "DRIVER" && session.user.role !== "ADMIN") redirect("/dashboard");

  const orders = await prisma.haulOrder.findMany({
    where:   { driver: { userId: session.user.id } },
    include: {
      buyer:   { select: { name: true, company: true, phone: true, email: true } },
      pit:     { select: { name: true, address: true, state: true } },
      project: { select: { name: true } },
    },
    orderBy: [{ status: "asc" }, { scheduledDate: "asc" }],
  });

  // Live pit-operator and driver counts for confirmed/active orders with a pit
  const liveOrders = orders.filter(
    (o) => o.pitId && (o.status === "CONFIRMED" || o.status === "ACTIVE")
  );
  const liveIds = liveOrders.map((o) => o.id);
  const [pitCounts, driverCounts] = await Promise.all([
    getPitOwnerLoadLogCounts(liveIds),
    getDriverLoadLogCounts(liveIds),
  ]);

  const respondOrderId = searchParams.respond;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard/driver" className="text-amber-600 hover:text-amber-700 text-sm font-medium">← Dashboard</Link>
        <span className="text-gray-300">|</span>
        <Link href="/" className="font-black text-black text-lg">Got Dirt?</Link>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Haul Orders</h1>

        {orders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <p className="text-gray-500 font-medium mb-1">No haul orders yet</p>
            <p className="text-sm text-gray-400">Complete your profile so buyers can find and book you.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((o) => {
              const isResponding = respondOrderId === o.id;
              const feePercent   = o.platformFeePercent > 0 ? o.platformFeePercent : 10.0;
              const isCompleted  = o.status === "COMPLETED" && o.actualLoads != null;
              const isLive       = o.status === "CONFIRMED" || o.status === "ACTIVE";
              const pitCount     = pitCounts[o.id];
              const driverCount  = driverCounts[o.id];
              const hasPitCount  = pitCount !== undefined;

              // For payout estimate: use current live pit count if available, else estimated loads
              const estimateBase = hasPitCount ? pitCount : o.loads;
              const payoutEstimate = Math.round(estimateBase * o.haulRateCents * (1 - feePercent / 100));

              return (
                <div key={o.id} className={`bg-white rounded-2xl border p-5 space-y-3 ${o.status === "PENDING" ? "border-amber-300" : "border-gray-200"}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-gray-900">{o.buyer.company ?? o.buyer.name ?? "Buyer"}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${statusColors[o.status] ?? "bg-gray-100 text-gray-600"}`}>
                          {o.status}
                        </span>
                      </div>
                      {o.pit && (
                        <p className="text-sm text-gray-500 mt-0.5">
                          {o.pit.name}{o.pit.address ? `, ${o.pit.address}` : ""} · {o.pit.state}
                        </p>
                      )}
                      {o.project && <p className="text-xs text-gray-400">{o.project.name}</p>}
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(o.scheduledDate).toLocaleDateString("en-US", {
                          weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit",
                        })}
                      </p>
                      {o.expiresAt && o.status === "PENDING" && (
                        <p className="text-xs text-red-500 mt-0.5">
                          First-come-first-served · Expires {new Date(o.expiresAt).toLocaleTimeString()}
                        </p>
                      )}
                    </div>

                    {/* ── Right column: loads + earnings ── */}
                    <div className="text-right shrink-0 space-y-0.5">
                      {isCompleted ? (
                        // Completed — show settled loads and full payout breakdown
                        <>
                          <p className="text-lg font-bold text-gray-900">
                            {o.actualLoads} load{o.actualLoads !== 1 ? "s" : ""}
                          </p>
                          {o.actualLoads !== o.loads && (
                            <p className="text-xs text-gray-400 line-through">{o.loads} est.</p>
                          )}
                          <p className="text-xs text-gray-400">
                            {o.actualLoads} × {fmt(o.haulRateCents)} = {fmt(o.actualLoads! * o.haulRateCents)}
                          </p>
                          <p className="text-xs text-gray-400">−{feePercent}% fee = {fmt(o.platformFeeCents)} kept by platform</p>
                          <p className="text-sm font-black text-green-700">{fmt(o.haulerPayoutCents)} earned</p>
                          {o.driverActualLoads != null && o.driverActualLoads !== o.actualLoads && (
                            <p className="text-xs text-amber-600">
                              Your GPS count: {o.driverActualLoads} · Pit count: {o.actualLoads} (used for billing)
                            </p>
                          )}
                        </>
                      ) : isLive && hasPitCount ? (
                        // Live session — show both counts + estimated payout
                        <>
                          <p className="text-lg font-bold text-gray-900">
                            {pitCount} load{pitCount !== 1 ? "s" : ""}
                          </p>
                          <p className="text-xs text-blue-600 font-semibold">Pit Log (live)</p>
                          {driverCount !== undefined && driverCount !== pitCount && (
                            <p className="text-xs text-gray-400">Your GPS: {driverCount}</p>
                          )}
                          {pitCount !== o.loads && (
                            <p className="text-xs text-gray-400 line-through">{o.loads} est.</p>
                          )}
                          <p className="text-xs text-gray-400">~{fmt(payoutEstimate)} est. earned</p>
                        </>
                      ) : (
                        // Pending / no live count yet
                        <>
                          <p className="text-lg font-bold text-gray-900">{o.loads} load{o.loads !== 1 ? "s" : ""}</p>
                          <p className="text-xs text-gray-400">est. @ {fmt(o.haulRateCents)}/load</p>
                          <p className="text-xs text-gray-400">~{fmt(payoutEstimate)} est. earned</p>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Live load detail strip */}
                  {isLive && hasPitCount && o.pit && (
                    <div className={`rounded-xl px-4 py-2.5 text-xs flex items-center gap-2 ${pitCount > 0 ? "bg-blue-50 text-blue-700" : "bg-gray-50 text-gray-500"}`}>
                      <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${pitCount > 0 ? "bg-blue-500 animate-pulse" : "bg-gray-300"}`} />
                      <span>
                        {pitCount > 0
                          ? `${pitCount} load${pitCount !== 1 ? "s" : ""} logged at ${o.pit.name} by pit operator`
                          : `Waiting for pit operator to start logging at ${o.pit.name}`}
                      </span>
                      {driverCount !== undefined && driverCount > 0 && (
                        <span className="ml-auto font-semibold text-blue-600">
                          Your count: {driverCount}
                        </span>
                      )}
                    </div>
                  )}

                  {o.notes && (
                    <div className="bg-gray-50 rounded-xl px-4 py-2.5 text-sm text-gray-600">{o.notes}</div>
                  )}

                  {o.status === "CONFIRMED" && (
                    <div className="pt-2 border-t border-gray-100 text-sm text-gray-500 flex gap-4 flex-wrap">
                      {o.buyer.phone && <span>📞 {o.buyer.phone}</span>}
                      {o.buyer.email && <span>✉️ {o.buyer.email}</span>}
                    </div>
                  )}

                  {o.status === "PENDING" && (
                    isResponding
                      ? <RespondForm orderId={o.id} />
                      : (
                        <div className="pt-3 border-t border-gray-100 flex gap-3">
                          <Link href={`/dashboard/driver/haul-orders?respond=${o.id}&action=CONFIRM`}
                            className="flex-1 text-center bg-green-600 text-white py-2 rounded-xl text-sm font-semibold hover:bg-green-700">
                            Confirm
                          </Link>
                          <Link href={`/dashboard/driver/haul-orders?respond=${o.id}&action=DENY`}
                            className="flex-1 text-center bg-white border border-gray-300 text-gray-600 py-2 rounded-xl text-sm font-semibold hover:bg-gray-50">
                            Deny
                          </Link>
                        </div>
                      )
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
