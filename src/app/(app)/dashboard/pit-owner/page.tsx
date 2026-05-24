import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { centsToDisplay } from "@/types";

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

  const [todayLoads, pendingSettlements, recentSettlements] = await Promise.all([
    pitIds.length > 0
      ? prisma.loadEvent.count({
          where: { pitId: { in: pitIds }, verified: true, disputed: false, createdAt: { gte: today } },
        })
      : Promise.resolve(0),
    pitIds.length > 0
      ? prisma.settlement.findMany({
          where: { order: { pitId: { in: pitIds } }, status: "PENDING", date: { gte: today } },
          include: { order: { select: { pit: { select: { name: true } } } } },
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
  ]);

  const todayEstimatedPayout = pendingSettlements.reduce((s, st) => s + st.netToPitCents, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <Link href="/" className="font-black text-black text-xl">Got Dirt?</Link>
        <Link href="/operator" className="bg-amber-600 text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-amber-700">
          LOG LOADS →
        </Link>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">
        <h1 className="text-2xl font-bold text-gray-900">Pit Owner Dashboard</h1>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-5 text-center">
            <p className="text-4xl font-black text-amber-600">{todayLoads}</p>
            <p className="text-sm text-gray-500 mt-1">Loads Today</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-5 text-center">
            <p className="text-2xl font-black text-gray-900">{todayEstimatedPayout > 0 ? centsToDisplay(todayEstimatedPayout) : "—"}</p>
            <p className="text-sm text-gray-500 mt-1">Today's Payout Est.</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-5 text-center">
            <p className="text-4xl font-black text-gray-900">{pits.length}</p>
            <p className="text-sm text-gray-500 mt-1">Active Pits</p>
          </div>
        </div>

        {/* Quick nav */}
        <div className="grid sm:grid-cols-4 gap-3">
          {[
            { href: "/dashboard/pit-owner/pits",          icon: "⛏️",  label: "My Pits" },
            { href: "/dashboard/pit-owner/load-history",  icon: "📋",  label: "Load History" },
            { href: "/dashboard/pit-owner/payout-history",icon: "💰",  label: "Payout History" },
            { href: "/dashboard/pit-owner/geofence",      icon: "📍",  label: "Geofence Map" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="bg-white rounded-2xl border border-gray-200 p-4 text-center hover:border-amber-400 transition-colors"
            >
              <p className="text-2xl mb-2">{item.icon}</p>
              <p className="text-sm font-semibold text-gray-700">{item.label}</p>
            </Link>
          ))}
        </div>

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
