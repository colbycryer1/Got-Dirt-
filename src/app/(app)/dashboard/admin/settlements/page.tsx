import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { centsToDisplay } from "@/types";

const STATUS_STYLES: Record<string, string> = {
  PROCESSED: "bg-sky-100 text-sky-700",
  PENDING:   "bg-amber-100 text-amber-700",
  FAILED:    "bg-red-100 text-red-700",
};

export default async function AdminSettlementsPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") redirect("/dashboard");

  const settlements = await prisma.settlement.findMany({
    include: {
      order: {
        select: {
          pit:   { select: { name: true } },
          buyer: { select: { name: true, company: true, email: true } },
        },
      },
    },
    orderBy: { date: "desc" },
    take: 200,
  });

  const totalGross     = settlements.filter((s) => s.status === "PROCESSED").reduce((sum, s) => sum + s.grossAmountCents, 0);
  const totalCommission = settlements.filter((s) => s.status === "PROCESSED").reduce((sum, s) => sum + s.commissionCents, 0);
  const failedCount    = settlements.filter((s) => s.status === "FAILED").length;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard/admin" className="text-amber-600 text-sm font-medium">← Admin</Link>
        <span className="font-black text-black text-lg">Got Dirt?</span>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-10 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Settlement Log</h1>
          <div className="flex gap-3">
            {failedCount > 0 && (
              <span className="bg-red-100 text-red-700 text-sm font-semibold px-3 py-1 rounded-full">
                {failedCount} failed
              </span>
            )}
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-5 text-center">
            <p className="text-2xl font-black text-gray-900">{centsToDisplay(totalGross)}</p>
            <p className="text-sm text-gray-500 mt-1">Total Gross Processed</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-5 text-center">
            <p className="text-2xl font-black text-amber-600">{centsToDisplay(totalCommission)}</p>
            <p className="text-sm text-gray-500 mt-1">Platform Commission (8%)</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-5 text-center">
            <p className="text-2xl font-black text-gray-900">{settlements.length}</p>
            <p className="text-sm text-gray-500 mt-1">Total Settlements</p>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {settlements.length === 0 ? (
            <div className="p-12 text-center text-gray-400">No settlements yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {["Date", "Pit", "Buyer", "Loads", "Gross", "Commission", "Net to Pit", "Status", "Stripe"].map((h) => (
                    <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {settlements.map((s) => (
                  <tr key={s.id} className={`hover:bg-gray-50 ${s.status === "FAILED" ? "bg-red-50" : ""}`}>
                    <td className="px-3 py-3 text-gray-600 whitespace-nowrap">{new Date(s.date).toLocaleDateString()}</td>
                    <td className="px-3 py-3 font-medium text-gray-900">{s.order.pit.name}</td>
                    <td className="px-3 py-3 text-gray-500">{s.order.buyer.company ?? s.order.buyer.name ?? s.order.buyer.email}</td>
                    <td className="px-3 py-3 text-gray-700">{s.verifiedLoadCount}</td>
                    <td className="px-3 py-3 text-gray-700">{centsToDisplay(s.grossAmountCents)}</td>
                    <td className="px-3 py-3 text-amber-700">{centsToDisplay(s.commissionCents)}</td>
                    <td className="px-3 py-3 font-semibold text-gray-900">{centsToDisplay(s.netToPitCents)}</td>
                    <td className="px-3 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLES[s.status] ?? "bg-gray-100 text-gray-500"}`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-400 font-mono">
                      {s.stripeChargeId ? s.stripeChargeId.slice(-8) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
