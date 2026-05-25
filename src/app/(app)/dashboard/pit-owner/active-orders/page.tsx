import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Active Orders — Got Dirt?" };

const haulStatusColors: Record<string, string> = {
  PENDING:   "bg-amber-100 text-amber-700",
  CONFIRMED: "bg-green-100 text-green-700",
  ACTIVE:    "bg-blue-100 text-blue-700",
  COMPLETED: "bg-gray-100 text-gray-500",
  CANCELLED: "bg-gray-100 text-gray-400",
};

export default async function PitOwnerActiveOrdersPage({
  searchParams,
}: {
  searchParams: { type?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== "PIT_OWNER" && session.user.role !== "ADMIN")) {
    redirect("/dashboard");
  }

  const pits = await prisma.pit.findMany({
    where:  { ownerId: session.user.id, status: "ACTIVE" },
    select: { id: true, name: true },
  });
  const pitIds = pits.map((p) => p.id);

  const typeFilter = searchParams.type ?? "all";

  const [matOrders, haulOrders] = pitIds.length > 0
    ? await Promise.all([
        typeFilter !== "haul"
          ? prisma.order.findMany({
              where: { pitId: { in: pitIds } },
              include: {
                pit:     { select: { name: true, state: true } },
                buyer:   { select: { name: true, company: true, phone: true, email: true } },
                project: { select: { name: true } },
                _count:  { select: { loadEvents: true } },
              },
              orderBy: [{ status: "asc" }, { date: "desc" }],
            })
          : Promise.resolve([]),
        typeFilter !== "pit"
          ? prisma.haulOrder.findMany({
              where: { pitId: { in: pitIds } },
              include: {
                pit:     { select: { name: true, state: true } },
                buyer:   { select: { name: true, company: true, phone: true } },
                driver:  { include: { user: { select: { name: true, phone: true } } } },
                carrier: { select: { companyName: true, user: { select: { name: true, phone: true } } } },
                project: { select: { name: true } },
              },
              orderBy: [{ status: "asc" }, { scheduledDate: "desc" }],
            })
          : Promise.resolve([]),
      ])
    : [[], []];

  const activeMatOrders  = matOrders.filter((o) => o.status === "ACTIVE");
  const closedMatOrders  = matOrders.filter((o) => o.status !== "ACTIVE");
  const activeHaulOrders = haulOrders.filter((o) => ["PENDING", "CONFIRMED", "ACTIVE"].includes(o.status));
  const closedHaulOrders = haulOrders.filter((o) => !["PENDING", "CONFIRMED", "ACTIVE"].includes(o.status));

  const totalActive = activeMatOrders.length + activeHaulOrders.length;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard/pit-owner" className="text-amber-600 hover:text-amber-700 text-sm font-medium">← Dashboard</Link>
        <span className="text-gray-300">|</span>
        <Link href="/" className="font-black text-black text-lg">Got Dirt?</Link>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h1 className="text-2xl font-bold text-gray-900">Active Orders</h1>
          <div className="flex gap-2">
            {[
              { key: "all",  label: "All" },
              { key: "pit",  label: "Pit Orders" },
              { key: "haul", label: "Haul Orders" },
            ].map((t) => (
              <Link key={t.key} href={`/dashboard/pit-owner/active-orders?type=${t.key}`}
                className={`text-xs px-3 py-1.5 rounded-full font-semibold transition-colors ${typeFilter === t.key ? "bg-gray-900 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-gray-400"}`}>
                {t.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Active Now",     value: totalActive },
            { label: "Pit Orders",     value: activeMatOrders.length },
            { label: "Haul Orders",    value: activeHaulOrders.length },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl border border-gray-200 p-5 text-center">
              <p className="text-2xl font-black text-gray-900">{s.value}</p>
              <p className="text-sm text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {totalActive === 0 && closedMatOrders.length === 0 && closedHaulOrders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-400">
            <p className="font-semibold text-gray-600 mb-1">No orders at your pits yet</p>
            <p className="text-sm">Buyers place orders when they need to pick up or drop off material.</p>
          </div>
        ) : (
          <div className="space-y-6">

            {/* ── Active Pit Material Orders ──────────────────────────────── */}
            {typeFilter !== "haul" && activeMatOrders.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Active Pit Orders</h2>
                <div className="space-y-3">
                  {activeMatOrders.map((o) => (
                    <div key={o.id} className="bg-white rounded-2xl border border-green-200 p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-gray-900">{o.buyer.company ?? o.buyer.name ?? "Buyer"}</p>
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">ACTIVE</span>
                          </div>
                          <p className="text-sm text-gray-500 mt-0.5">{o.pit.name} · {o.pit.state}</p>
                          <p className="text-xs text-gray-400">{o.project.name}</p>
                          <p className="text-xs text-gray-400 mt-1">{new Date(o.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</p>
                          {(o.buyer.phone || o.buyer.email) && (
                            <div className="flex gap-3 mt-1 text-xs text-gray-500">
                              {o.buyer.phone && <span>📞 {o.buyer.phone}</span>}
                              {o.buyer.email && <span>✉️ {o.buyer.email}</span>}
                            </div>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-lg font-bold text-gray-900">{o._count.loadEvents}</p>
                          <p className="text-xs text-gray-400">loads logged</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── Active Haul Orders ──────────────────────────────────────── */}
            {typeFilter !== "pit" && activeHaulOrders.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Active Haul Orders</h2>
                <div className="space-y-3">
                  {activeHaulOrders.map((o) => {
                    const haulerName = o.carrier?.companyName ?? o.carrier?.user.name
                      ?? o.driver?.user.name ?? "Open Broadcast";
                    const haulerPhone = o.driver?.user.phone ?? o.carrier?.user.phone;
                    return (
                      <div key={o.id} className="bg-white rounded-2xl border border-indigo-200 p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-bold text-gray-900">{o.buyer.company ?? o.buyer.name ?? "Buyer"}</p>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${haulStatusColors[o.status] ?? "bg-gray-100 text-gray-600"}`}>
                                {o.status}
                              </span>
                              <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-semibold">Haul</span>
                            </div>
                            <p className="text-sm text-gray-500 mt-0.5">{o.pit?.name} · {o.pit?.state}</p>
                            <p className="text-xs text-gray-400">Hauler: {haulerName}</p>
                            <p className="text-xs text-gray-400 mt-1">
                              {new Date(o.scheduledDate).toLocaleDateString("en-US", {
                                weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                              })}
                            </p>
                            <div className="flex gap-3 mt-1 text-xs text-gray-500">
                              {o.buyer.phone && <span>📞 Buyer: {o.buyer.phone}</span>}
                              {haulerPhone && <span>🚛 Hauler: {haulerPhone}</span>}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-lg font-bold text-gray-900">{o.loads}</p>
                            <p className="text-xs text-gray-400">est. loads</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ── Closed / History ────────────────────────────────────────── */}
            {(closedMatOrders.length > 0 || closedHaulOrders.length > 0) && (
              <section>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Recent History</h2>
                <div className="space-y-2">
                  {closedMatOrders.slice(0, 5).map((o) => (
                    <div key={o.id} className="bg-white rounded-xl border border-gray-200 px-5 py-3 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900">{o.buyer.company ?? o.buyer.name}</p>
                        <p className="text-xs text-gray-400">{o.pit.name} · {new Date(o.date).toLocaleDateString()}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-semibold text-gray-600">{o._count.loadEvents} loads</p>
                        <span className="text-xs text-gray-400">{o.status}</span>
                      </div>
                    </div>
                  ))}
                  {closedHaulOrders.slice(0, 5).map((o) => {
                    const haulerName = o.carrier?.companyName ?? o.driver?.user.name ?? "—";
                    return (
                      <div key={o.id} className="bg-white rounded-xl border border-gray-200 px-5 py-3 flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900">{o.buyer.company ?? o.buyer.name} → {haulerName}</p>
                          <p className="text-xs text-gray-400">{o.pit?.name} · {new Date(o.scheduledDate).toLocaleDateString()}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-semibold text-gray-600">{o.actualLoads ?? o.loads} loads</p>
                          <span className={`text-xs ${haulStatusColors[o.status] ?? "text-gray-400"} px-1.5 py-0.5 rounded-full`}>{o.status}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

          </div>
        )}
      </div>
    </div>
  );
}
