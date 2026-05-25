import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "My Loads — Got Dirt?" };

const statusColors: Record<string, string> = {
  CONFIRMED: "bg-green-100 text-green-700",
  ACTIVE:    "bg-blue-100 text-blue-700",
  COMPLETED: "bg-gray-100 text-gray-600",
  PENDING:   "bg-amber-100 text-amber-700",
  DENIED:    "bg-red-100 text-red-500",
  CANCELLED: "bg-gray-100 text-gray-400",
};

export default async function DriverLoadsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role !== "DRIVER" && session.user.role !== "ADMIN") redirect("/dashboard");

  const profile = await prisma.driverProfile.findUnique({
    where:  { userId: session.user.id },
    select: { id: true },
  });

  // HaulOrders are the primary source of driver load history
  const haulOrders = profile
    ? await prisma.haulOrder.findMany({
        where:   { driverId: profile.id },
        include: {
          pit:     { select: { name: true, state: true, materialTypes: true } },
          buyer:   { select: { name: true, company: true } },
          project: { select: { name: true } },
        },
        orderBy: { scheduledDate: "desc" },
      })
    : [];

  const completed    = haulOrders.filter((o) => o.status === "COMPLETED");
  const inProgress   = haulOrders.filter((o) => o.status === "ACTIVE" || o.status === "CONFIRMED");
  const totalLoads   = completed.reduce((s, o) => s + o.loads, 0);
  const totalEarned  = completed.reduce((s, o) => s + o.haulerPayoutCents, 0);

  // Material breakdown across all completed haul orders
  const byMaterial: Record<string, number> = {};
  for (const o of completed) {
    for (const m of o.pit?.materialTypes ?? []) {
      byMaterial[m] = (byMaterial[m] ?? 0) + o.loads;
    }
  }
  const materialRows = Object.entries(byMaterial).sort((a, b) => b[1] - a[1]);

  // Group by month
  const byMonth: Record<string, { label: string; loads: number; earnedCents: number }> = {};
  for (const o of completed) {
    const key = new Date(o.scheduledDate).toLocaleDateString("en-US", { year: "numeric", month: "long" });
    if (!byMonth[key]) byMonth[key] = { label: key, loads: 0, earnedCents: 0 };
    byMonth[key].loads       += o.loads;
    byMonth[key].earnedCents += o.haulerPayoutCents;
  }

  function fmt(cents: number) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard/driver" className="text-amber-600 hover:text-amber-700 text-sm font-medium">
          ← Dashboard
        </Link>
        <span className="text-gray-300">|</span>
        <Link href="/" className="font-black text-black text-lg">Got Dirt?</Link>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        <h1 className="text-2xl font-bold text-gray-900">My Loads</h1>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-5 text-center">
            <p className="text-2xl font-black text-gray-900">{totalLoads}</p>
            <p className="text-sm text-gray-500 mt-1">Loads Completed</p>
          </div>
          <div className="bg-white rounded-2xl border border-green-200 p-5 text-center">
            <p className="text-2xl font-black text-green-700">{completed.length}</p>
            <p className="text-sm text-gray-500 mt-1">Jobs Done</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-5 text-center">
            <p className="text-xl font-black text-gray-900">{fmt(totalEarned)}</p>
            <p className="text-sm text-gray-500 mt-1">Total Earned</p>
          </div>
        </div>

        {/* In-progress jobs */}
        {inProgress.length > 0 && (
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-3">In Progress</h2>
            <div className="space-y-3">
              {inProgress.map((o) => (
                <div key={o.id} className="bg-white rounded-2xl border border-blue-200 p-5 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900">{o.buyer.company ?? o.buyer.name ?? "Buyer"}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${statusColors[o.status] ?? ""}`}>
                        {o.status}
                      </span>
                    </div>
                    {o.pit && <p className="text-sm text-gray-500">{o.pit.name} · {o.pit.state}</p>}
                    {o.pit?.materialTypes?.length ? (
                      <p className="text-xs text-gray-400 mt-0.5">{o.pit.materialTypes.join(" · ")}</p>
                    ) : null}
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(o.scheduledDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-gray-900">{o.loads} loads</p>
                    <p className="text-sm text-amber-600">{fmt(o.haulerPayoutCents)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Material breakdown */}
        {materialRows.length > 0 && (
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-3">By Material</h2>
            <div className="flex flex-wrap gap-2">
              {materialRows.map(([mat, count]) => (
                <span key={mat} className="bg-white border border-gray-200 rounded-full px-4 py-1.5 text-sm font-medium text-gray-700">
                  {mat} <span className="text-gray-400">×{count}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Monthly breakdown */}
        {Object.keys(byMonth).length > 0 && (
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-3">Monthly Summary</h2>
            <div className="space-y-2">
              {Object.values(byMonth).map((m) => (
                <div key={m.label} className="bg-white rounded-xl border border-gray-200 px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-800">{m.label}</p>
                    <p className="text-xs text-gray-400">{m.loads} load{m.loads !== 1 ? "s" : ""}</p>
                  </div>
                  <p className="font-bold text-gray-900">{fmt(m.earnedCents)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Full haul history */}
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-3">Haul History</h2>
          {haulOrders.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-400">
              <p className="font-semibold text-gray-600 mb-1">No haul jobs yet</p>
              <p className="text-sm">Completed haul orders will appear here with load counts and earnings.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {haulOrders.map((o) => (
                <div key={o.id} className="bg-white rounded-2xl border border-gray-200 p-5 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900">{o.buyer.company ?? o.buyer.name ?? "Buyer"}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${statusColors[o.status] ?? "bg-gray-100 text-gray-500"}`}>
                        {o.status}
                      </span>
                    </div>
                    {o.pit && <p className="text-sm text-gray-500">{o.pit.name} · {o.pit.state}</p>}
                    {o.pit?.materialTypes?.length ? (
                      <p className="text-xs text-gray-400 mt-0.5">{o.pit.materialTypes.join(" · ")}</p>
                    ) : null}
                    {o.project && <p className="text-xs text-gray-400">{o.project.name}</p>}
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(o.scheduledDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-gray-900">{o.loads} load{o.loads !== 1 ? "s" : ""}</p>
                    {o.status === "COMPLETED" && (
                      <p className="text-sm font-semibold text-green-700">{fmt(o.haulerPayoutCents)}</p>
                    )}
                    {o.status !== "COMPLETED" && (
                      <p className="text-xs text-gray-400">est. {fmt(o.haulerPayoutCents)}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
