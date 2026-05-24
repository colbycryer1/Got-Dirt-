import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function PitOwnerAnalyticsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if (session.user.role !== "PIT_OWNER" && session.user.role !== "ADMIN") redirect("/dashboard");

  const eightWeeksAgo = new Date();
  eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);

  const [pits, recentSettlements, loadsByMaterial, weeklyLoads] = await Promise.all([
    prisma.pit.findMany({
      where:   { ownerId: session.user.id, status: "ACTIVE" },
      select:  { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.settlement.findMany({
      where: {
        order: { pit: { ownerId: session.user.id } },
        status: "PROCESSED",
        date: { gte: eightWeeksAgo },
      },
      include: { order: { select: { pit: { select: { name: true } } } } },
      orderBy: { date: "desc" },
    }),
    prisma.loadEvent.groupBy({
      by: ["materialType"],
      where: {
        order: { pit: { ownerId: session.user.id } },
        verified: true,
        disputed: false,
        createdAt: { gte: eightWeeksAgo },
      },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    }),
    prisma.loadEvent.findMany({
      where: {
        order: { pit: { ownerId: session.user.id } },
        verified: true,
        disputed: false,
        createdAt: { gte: eightWeeksAgo },
      },
      select: { createdAt: true, rateCentsAtTime: true },
    }),
  ]);

  // Build weekly buckets
  const weeks = buildWeeklyBuckets(weeklyLoads, 8);
  const totalLoads    = weeks.reduce((s, w) => s + w.loads, 0);
  const totalRevenue  = recentSettlements.reduce((s, r) => s + r.netToPitCents, 0);
  const avgLoadsWeek  = totalLoads > 0 ? Math.round(totalLoads / 8) : 0;
  const maxLoads      = Math.max(...weeks.map((w) => w.loads), 1);

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard/pit-owner" className="text-amber-600 text-sm font-medium hover:underline">
          ← My Dashboard
        </Link>
        <span className="font-black text-black text-lg">Got Dirt?</span>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>

        {pits.length === 0 ? (
          <div className="text-center py-12 text-gray-400">No active pits to show analytics for.</div>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Loads (8 wks)", value: totalLoads },
                { label: "Avg loads/week", value: avgLoadsWeek },
                { label: "Net revenue (8 wks)", value: `$${(totalRevenue / 100).toLocaleString()}` },
                { label: "Active pits", value: pits.length },
              ].map((k) => (
                <div key={k.label} className="bg-white rounded-2xl border border-gray-200 p-5">
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{k.label}</p>
                  <p className="text-2xl font-bold text-gray-900">{k.value}</p>
                </div>
              ))}
            </div>

            {/* Weekly loads bar chart */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-800 mb-4">Loads per Week (last 8 weeks)</h2>
              <div className="flex items-end gap-2 h-40">
                {weeks.map((w) => (
                  <div key={w.label} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-xs text-gray-500 font-medium">{w.loads || ""}</span>
                    <div
                      className="w-full bg-amber-500 rounded-t-md transition-all"
                      style={{ height: `${Math.round((w.loads / maxLoads) * 128)}px`, minHeight: w.loads ? "4px" : "2px" }}
                    />
                    <span className="text-[10px] text-gray-400 text-center leading-tight">{w.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Material types */}
            {loadsByMaterial.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h2 className="font-semibold text-gray-800 mb-4">Loads by Material Type</h2>
                <div className="space-y-3">
                  {loadsByMaterial.map((m) => {
                    const pct = Math.round((m._count.id / totalLoads) * 100);
                    return (
                      <div key={m.materialType} className="flex items-center gap-3">
                        <div className="w-28 text-sm text-gray-700 truncate">{m.materialType}</div>
                        <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                          <div className="h-full bg-amber-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="text-sm text-gray-600 w-20 text-right">
                          {m._count.id} ({pct}%)
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recent settlements */}
            {recentSettlements.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h2 className="font-semibold text-gray-800">Recent Settlements</h2>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {["Date", "Pit", "Loads", "Gross", "Net to You"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {recentSettlements.slice(0, 20).map((s) => (
                      <tr key={s.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-500">{new Date(s.date).toLocaleDateString()}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{s.order.pit.name}</td>
                        <td className="px-4 py-3 text-gray-600">{s.verifiedLoadCount}</td>
                        <td className="px-4 py-3 text-gray-600">${(s.grossAmountCents / 100).toFixed(2)}</td>
                        <td className="px-4 py-3 font-semibold text-green-700">${(s.netToPitCents / 100).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function buildWeeklyBuckets(
  loads: Array<{ createdAt: Date; rateCentsAtTime: number }>,
  numWeeks: number
) {
  const now = new Date();
  return Array.from({ length: numWeeks }, (_, i) => {
    const weekEnd   = new Date(now);
    weekEnd.setDate(weekEnd.getDate() - i * 7);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekStart.getDate() - 7);

    const weekLoads = loads.filter(
      (l) => l.createdAt >= weekStart && l.createdAt < weekEnd
    );

    const month = weekEnd.toLocaleString("en-US", { month: "short" });
    const day   = weekEnd.getDate();
    return { label: `${month} ${day}`, loads: weekLoads.length };
  }).reverse();
}
