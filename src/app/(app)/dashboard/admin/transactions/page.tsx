import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { centsToDisplay } from "@/types";

export const metadata = { title: "Transactions — Got Dirt? Admin" };

const STATUS_STYLES: Record<string, string> = {
  PROCESSED: "bg-green-100 text-green-700",
  PENDING:   "bg-amber-100 text-amber-700",
  FAILED:    "bg-red-100 text-red-700",
};

export default async function AdminTransactionsPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") redirect("/dashboard");

  const [settlements, allTimeStats, thirtyDayStats] = await Promise.all([
    prisma.settlement.findMany({
      include: {
        order: {
          select: {
            pit:   { select: { name: true, state: true } },
            buyer: { select: { name: true, company: true, email: true } },
          },
        },
      },
      orderBy: { date: "desc" },
      take: 500,
    }),

    prisma.settlement.aggregate({
      where: { status: "PROCESSED" },
      _sum:  { grossAmountCents: true, commissionCents: true, netToPitCents: true, verifiedLoadCount: true },
      _count: { _all: true },
    }),

    prisma.settlement.aggregate({
      where: { status: "PROCESSED", date: { gte: new Date(Date.now() - 30 * 86400000) } },
      _sum:  { grossAmountCents: true, commissionCents: true, verifiedLoadCount: true },
      _count: { _all: true },
    }),
  ]);

  const failedCount = settlements.filter((s) => s.status === "FAILED").length;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard/admin" className="text-amber-600 text-sm font-medium">← Admin</Link>
        <span className="text-gray-300">|</span>
        <span className="font-black text-black text-lg">Got Dirt?</span>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-10 space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
          {failedCount > 0 && (
            <span className="bg-red-100 text-red-700 text-sm font-semibold px-3 py-1.5 rounded-full">
              {failedCount} failed charge{failedCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* All-time stats */}
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-3">All Time</p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: "Settlements",       value: allTimeStats._count._all },
              { label: "Loads Charged",     value: (allTimeStats._sum.verifiedLoadCount ?? 0).toLocaleString() },
              { label: "Gross Volume",      value: centsToDisplay(allTimeStats._sum.grossAmountCents  ?? 0) },
              { label: "Platform Revenue",  value: centsToDisplay(allTimeStats._sum.commissionCents   ?? 0), highlight: true },
              { label: "Paid to Pit Owners",value: centsToDisplay(allTimeStats._sum.netToPitCents     ?? 0) },
            ].map((s) => (
              <div key={s.label} className={`bg-white rounded-2xl border p-4 text-center ${s.highlight ? "border-green-300" : "border-gray-200"}`}>
                <p className={`text-xl font-black ${s.highlight ? "text-green-700" : "text-gray-900"}`}>{s.value}</p>
                <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Last 30 days */}
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-3">Last 30 Days</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Settlements",      value: thirtyDayStats._count._all },
              { label: "Loads Charged",    value: (thirtyDayStats._sum.verifiedLoadCount ?? 0).toLocaleString() },
              { label: "Gross Volume",     value: centsToDisplay(thirtyDayStats._sum.grossAmountCents ?? 0) },
              { label: "Platform Revenue", value: centsToDisplay(thirtyDayStats._sum.commissionCents  ?? 0), highlight: true },
            ].map((s) => (
              <div key={s.label} className={`bg-white rounded-2xl border p-4 text-center ${s.highlight ? "border-green-300" : "border-gray-200"}`}>
                <p className={`text-xl font-black ${s.highlight ? "text-green-700" : "text-gray-900"}`}>{s.value}</p>
                <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Transaction table */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">All Charges</h2>
            <p className="text-xs text-gray-400">{settlements.length} record{settlements.length !== 1 ? "s" : ""}</p>
          </div>
          {settlements.length === 0 ? (
            <div className="p-12 text-center text-gray-400">No transactions yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {["Date", "Pit", "State", "Buyer", "Loads", "Rate/Load", "Gross", "Platform (8%)", "Pit Payout", "Status", "Stripe ID"].map((h) => (
                      <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {settlements.map((s) => {
                    const ratePerLoad = s.verifiedLoadCount > 0
                      ? Math.round(s.grossAmountCents / s.verifiedLoadCount)
                      : 0;
                    return (
                      <tr key={s.id} className={`hover:bg-gray-50 ${s.status === "FAILED" ? "bg-red-50" : ""}`}>
                        <td className="px-3 py-3 text-gray-600 whitespace-nowrap">
                          {new Date(s.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </td>
                        <td className="px-3 py-3 font-medium text-gray-900 whitespace-nowrap">{s.order.pit.name}</td>
                        <td className="px-3 py-3 text-gray-500">{s.order.pit.state}</td>
                        <td className="px-3 py-3 text-gray-500 whitespace-nowrap">
                          {s.order.buyer.company ?? s.order.buyer.name ?? s.order.buyer.email}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">
                            {s.verifiedLoadCount}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-gray-600">{ratePerLoad > 0 ? centsToDisplay(ratePerLoad) : "—"}</td>
                        <td className="px-3 py-3 font-semibold text-gray-900">{centsToDisplay(s.grossAmountCents)}</td>
                        <td className="px-3 py-3 font-semibold text-green-700">{centsToDisplay(s.commissionCents)}</td>
                        <td className="px-3 py-3 text-gray-700">{centsToDisplay(s.netToPitCents)}</td>
                        <td className="px-3 py-3">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_STYLES[s.status] ?? "bg-gray-100 text-gray-500"}`}>
                            {s.status}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-xs text-gray-400 font-mono">
                          {s.stripeChargeId ? s.stripeChargeId.slice(-12) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
