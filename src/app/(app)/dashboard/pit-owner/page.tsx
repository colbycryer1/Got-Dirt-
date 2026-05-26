import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { centsToDisplay } from "@/types";
import LogoutButton from "@/components/LogoutButton";

export default async function PitOwnerDashboard() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== "PIT_OWNER" && session.user.role !== "ADMIN")) {
    redirect("/dashboard");
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const pits = await prisma.pit.findMany({
    where: { ownerId: session.user.id, status: "ACTIVE" },
    select: { id: true, name: true },
  });
  const pitIds = pits.map((p) => p.id);

  const [todayLoadEvents, recentSettlements, activeOrders, activeHaulOrders, pendingAmendmentCount] = await Promise.all([
    pitIds.length > 0
      ? prisma.loadEvent.findMany({
          where: { pitId: { in: pitIds }, verified: true, disputed: false, createdAt: { gte: today } },
          select: { rateCentsAtTime: true },
        })
      : Promise.resolve([]),
    pitIds.length > 0
      ? prisma.settlement.findMany({
          where: { order: { pitId: { in: pitIds } }, status: "PROCESSED" },
          include: { order: { select: { pit: { select: { name: true } } } } },
          orderBy: { date: "desc" },
          take: 5,
        })
      : Promise.resolve([]),
    // Active pit material Orders
    pitIds.length > 0
      ? prisma.order.findMany({
          where: { pitId: { in: pitIds }, status: "ACTIVE" },
          include: {
            pit:     { select: { name: true } },
            buyer:   { select: { name: true, company: true } },
            project: { select: { name: true } },
            _count:  { select: { loadEvents: true } },
          },
          orderBy: { date: "desc" },
          take: 8,
        })
      : Promise.resolve([]),
    // Active haul orders at their pits
    pitIds.length > 0
      ? prisma.haulOrder.findMany({
          where: {
            pitId:  { in: pitIds },
            status: { in: ["PENDING", "CONFIRMED", "ACTIVE"] },
          },
          include: {
            pit:     { select: { name: true } },
            buyer:   { select: { name: true, company: true } },
            driver:  { include: { user: { select: { name: true } } } },
            carrier: { select: { companyName: true, user: { select: { name: true } } } },
          },
          orderBy: { scheduledDate: "asc" },
          take: 8,
        })
      : Promise.resolve([]),
    // Pending amendments needing pit owner approval
    pitIds.length > 0
      ? prisma.haulOrderAmendment.count({
          where: {
            status:           "PENDING",
            pitOwnerApproved: null,
            haulOrder:        { pitId: { in: pitIds } },
          },
        })
      : Promise.resolve(0),
  ]);

  const feeSettings = await prisma.platformSettings.findUnique({ where: { id: "singleton" } });
  const feePercent = feeSettings?.feePercent ?? 8.0;

  const todayLoads = todayLoadEvents.length;
  const todayGrossCents = todayLoadEvents.reduce((s, l) => s + l.rateCentsAtTime, 0);
  const todayEstimatedPayout = Math.round(todayGrossCents * (1 - feePercent / 100));

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <Link href="/" className="font-black text-black text-xl">Got Dirt?</Link>
        <div className="flex items-center gap-4">
          <LogoutButton />
          <Link href="/operator" className="bg-amber-600 text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-amber-700">
            LOG LOADS →
          </Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">
        <h1 className="text-2xl font-bold text-gray-900">Pit Owner Dashboard</h1>

        {/* Amendment alert */}
        {pendingAmendmentCount > 0 && (
          <Link href="/dashboard/pit-owner/active-orders"
            className="block bg-amber-50 border border-amber-300 rounded-2xl p-4 hover:bg-amber-100 transition-colors">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-xl">⚠️</span>
                <div>
                  <p className="font-bold text-amber-800">
                    {pendingAmendmentCount} Amendment{pendingAmendmentCount !== 1 ? "s" : ""} Awaiting Your Approval
                  </p>
                  <p className="text-sm text-amber-700">
                    A buyer has requested extra loads — tap to review and approve or deny.
                  </p>
                </div>
              </div>
              <span className="text-amber-600 font-bold shrink-0">Review →</span>
            </div>
          </Link>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-5 text-center">
            <p className="text-4xl font-black text-amber-600">{todayLoads}</p>
            <p className="text-sm text-gray-500 mt-1">Loads Today</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-5 text-center">
            <p className="text-2xl font-black text-gray-900">{todayEstimatedPayout > 0 ? centsToDisplay(todayEstimatedPayout) : "—"}</p>
            <p className="text-sm text-gray-500 mt-1">Today&apos;s Payout Est.</p>
            {todayGrossCents > 0 && (
              <p className="text-xs text-gray-400 mt-0.5">{centsToDisplay(todayGrossCents)} gross · {feePercent}% fee</p>
            )}
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-5 text-center">
            <p className="text-4xl font-black text-gray-900">{pits.length}</p>
            <p className="text-sm text-gray-500 mt-1">Active Pits</p>
          </div>
        </div>

        {/* Quick nav */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { href: "/dashboard/pit-owner/active-orders", icon: "📋",  label: "Active Orders",
              badge: pendingAmendmentCount > 0 ? pendingAmendmentCount : 0 },
            { href: "/dashboard/pit-owner/pits",          icon: "⛏️",  label: "My Pits" },
            { href: "/dashboard/pit-owner/load-history",  icon: "🗂️",  label: "Load History" },
            { href: "/dashboard/pit-owner/payout-history",icon: "💰",  label: "Payout History" },
            { href: "/dashboard/pit-owner/analytics",     icon: "📊",  label: "Analytics" },
            { href: "/dashboard/pit-owner/geofence",      icon: "📍",  label: "Geofence Map" },
            { href: "/dashboard/pit-owner/claim",         icon: "🏷️",  label: "Claim a Pit" },
            { href: "/account/stripe",                    icon: "🏦",  label: "Stripe Payouts" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`relative bg-white rounded-2xl border p-4 text-center hover:border-amber-400 transition-colors ${
                "badge" in item && item.badge ? "border-amber-300 bg-amber-50" : "border-gray-200"
              }`}
            >
              {"badge" in item && (item.badge ?? 0) > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                  {item.badge}
                </span>
              )}
              <p className="text-2xl mb-2">{item.icon}</p>
              <p className="text-sm font-semibold text-gray-700">{item.label}</p>
            </Link>
          ))}
        </div>

        {/* Active Orders at your pits */}
        {(activeOrders.length > 0 || activeHaulOrders.length > 0) && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-gray-900">Active Orders</h2>
              <Link href="/dashboard/pit-owner/active-orders" className="text-amber-600 text-sm font-medium">View all →</Link>
            </div>
            <div className="space-y-2">
              {activeOrders.map((o) => (
                <div key={o.id} className="bg-white rounded-2xl border border-green-200 p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">Pit Order</span>
                      <p className="font-semibold text-gray-900 text-sm">{o.buyer.company ?? o.buyer.name ?? "Buyer"}</p>
                    </div>
                    <p className="text-xs text-gray-500">{o.pit.name} · {o.project.name}</p>
                    <p className="text-xs text-gray-400">{new Date(o.date).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-gray-900">{o._count.loadEvents} loads</p>
                    <span className="text-xs text-green-600 font-semibold">ACTIVE</span>
                  </div>
                </div>
              ))}
              {activeHaulOrders.map((o) => {
                const haulerName = o.carrier?.companyName ?? o.carrier?.user.name
                  ?? o.driver?.user.name ?? "Open Broadcast";
                const statusColors: Record<string, string> = {
                  PENDING:   "bg-amber-100 text-amber-700",
                  CONFIRMED: "bg-green-100 text-green-700",
                  ACTIVE:    "bg-blue-100 text-blue-700",
                };
                return (
                  <div key={o.id} className="bg-white rounded-2xl border border-indigo-200 p-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-semibold">Haul Order</span>
                        <p className="font-semibold text-gray-900 text-sm">{o.buyer.company ?? o.buyer.name ?? "Buyer"}</p>
                      </div>
                      <p className="text-xs text-gray-500">{o.pit?.name} · Hauler: {haulerName}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(o.scheduledDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-gray-900">{o.loads} loads</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${statusColors[o.status] ?? "bg-gray-100 text-gray-500"}`}>
                        {o.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recent settlements */}
        {recentSettlements.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-gray-900">Recent Payouts</h2>
              <Link href="/dashboard/pit-owner/payout-history" className="text-amber-600 text-sm font-medium">View all →</Link>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {["Date", "Pit", "Loads", "Net Payout"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recentSettlements.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-600">{new Date(s.date).toLocaleDateString()}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{s.order.pit.name}</td>
                      <td className="px-4 py-3 text-gray-600">{s.verifiedLoadCount}</td>
                      <td className="px-4 py-3 font-semibold text-gray-900">{centsToDisplay(s.netToPitCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {pits.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center text-gray-400">
            <p className="text-4xl mb-4">⛏️</p>
            <p className="font-semibold text-gray-600 mb-2">No pits listed yet</p>
            <Link href="/dashboard/pit-owner/pits/new" className="text-amber-600 font-medium hover:underline text-sm">
              Add your first pit →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
