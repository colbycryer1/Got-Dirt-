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
    where: { ownerId: session.user.id },
    select: { id: true, name: true },
  });
  const pitIds = pits.map((p) => p.id);

  const loads = pitIds.length > 0 ? await prisma.loadEvent.findMany({
    where: { pitId: { in: pitIds } },
    include: {
      pit:   { select: { name: true } },
      order: { select: { buyer: { select: { name: true, company: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  }) : [];

  // Group by date for daily totals
  const byDate: Record<string, { count: number; disputed: number }> = {};
  for (const l of loads) {
    const key = new Date(l.createdAt).toLocaleDateString();
    if (!byDate[key]) byDate[key] = { count: 0, disputed: 0 };
    byDate[key].count++;
    if (l.disputed) byDate[key].disputed++;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard/pit-owner" className="text-amber-600 text-sm font-medium">← Dashboard</Link>
        <span className="font-black text-black text-lg">Got Dirt?</span>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Load History</h1>
          <span className="text-sm text-gray-500">{loads.length} loads (last 200)</span>
        </div>

        {/* Daily summary */}
        {Object.keys(byDate).length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Daily Summary</p>
            </div>
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100">
                <tr>
                  {["Date", "Loads", "Disputed"].map((h) => (
                    <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {Object.entries(byDate).map(([date, data]) => (
                  <tr key={date} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-800">{date}</td>
                    <td className="px-4 py-2">
                      <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">{data.count}</span>
                    </td>
                    <td className="px-4 py-2 text-gray-500">{data.disputed > 0 ? <span className="text-red-500 font-medium">{data.disputed}</span> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Individual loads */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Individual Loads</p>
          </div>
          {loads.length === 0 ? (
            <div className="p-10 text-center text-gray-400">
              <p>No loads recorded yet.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100">
                <tr>
                  {["Time", "Pit", "Material", "Method", "Buyer", "Status"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loads.map((l) => (
                  <tr key={l.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {new Date(l.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{l.pit.name}</td>
                    <td className="px-4 py-3 text-gray-600">{l.materialType}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${l.verificationMethod === "OPERATOR" ? "bg-amber-100 text-amber-700" : "bg-sky-100 text-sky-700"}`}>
                        {l.verificationMethod === "OPERATOR" ? "Manual" : "GPS"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{l.order.buyer.company ?? l.order.buyer.name ?? "—"}</td>
                    <td className="px-4 py-3">
                      {l.disputed
                        ? <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">Disputed</span>
                        : l.verified
                          ? <span className="text-xs font-semibold text-sky-600 bg-sky-50 px-2 py-0.5 rounded-full">Verified</span>
                          : <span className="text-xs text-gray-400">Pending</span>
                      }
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
