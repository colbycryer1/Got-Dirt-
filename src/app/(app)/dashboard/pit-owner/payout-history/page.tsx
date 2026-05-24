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

export default async function PayoutHistoryPage() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== "PIT_OWNER" && session.user.role !== "ADMIN")) {
    redirect("/dashboard");
  }

  const pits = await prisma.pit.findMany({
    where: { ownerId: session.user.id },
    select: { id: true },
  });
  const pitIds = pits.map((p) => p.id);

  const settlements = pitIds.length > 0 ? await prisma.settlement.findMany({
    where: { order: { pitId: { in: pitIds } } },
    include: { order: { select: { pit: { select: { name: true } }, buyer: { select: { company: true, name: true } } } } },
    orderBy: { date: "desc" },
    take: 100,
  }) : [];

  const totalNet   = settlements.filter((s) => s.status === "PROCESSED").reduce((sum, s) => sum + s.netToPitCents, 0);
  const totalLoads = settlements.filter((s) => s.status === "PROCESSED").reduce((sum, s) => sum + s.verifiedLoadCount, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard/pit-owner" className="text-amber-600 text-sm font-medium">← Dashboard</Link>
        <span className="font-black text-black text-lg">Got Dirt?</span>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10 space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Payout History</h1>

        {/* Totals */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-5 text-center">
            <p className="text-3xl font-black text-gray-900">{centsToDisplay(totalNet)}</p>
            <p className="text-sm text-gray-500 mt-1">Total Received</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-5 text-center">
            <p className="text-3xl font-black text-gray-900">{totalLoads}</p>
            <p className="text-sm text-gray-500 mt-1">Total Verified Loads</p>
          </div>
        </div>

        {/* Settlements table */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {settlements.length === 0 ? (
            <div className="p-10 text-center text-gray-400">No settlements yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {["Date", "Pit", "Buyer", "Loads", "Gross", "Net Payout", "Status"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {settlements.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{new Date(s.date).toLocaleDateString()}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{s.order.pit.name}</td>
                    <td className="px-4 py-3 text-gray-500">{s.order.buyer.company ?? s.order.buyer.name ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-700">{s.verifiedLoadCount}</td>
                    <td className="px-4 py-3 text-gray-700">{centsToDisplay(s.grossAmountCents)}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{centsToDisplay(s.netToPitCents)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLES[s.status] ?? "bg-gray-100 text-gray-500"}`}>
                        {s.status}
                      </span>
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
