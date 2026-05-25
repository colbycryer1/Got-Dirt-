import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Revenue Tracker — Got Dirt? Admin" };

function fmt(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export default async function AdminRevenuePage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") redirect("/dashboard");

  // ── Pit settlement revenue ───────────────────────────────────────────────
  const settlements = await prisma.settlement.findMany({
    where: { status: "PROCESSED" },
    include: {
      order: {
        include: {
          pit:    { select: { name: true, address: true, state: true, pitType: true } },
          buyer:  { select: { name: true, company: true, email: true } },
          loadEvents: {
            where:  { verified: true },
            select: { materialType: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  // ── Haul order revenue ───────────────────────────────────────────────────
  const haulOrders = await prisma.haulOrder.findMany({
    where: {
      status:          "COMPLETED",
      platformFeeCents: { gt: 0 },
    },
    include: {
      buyer:   { select: { name: true, company: true, email: true } },
      pit:     { select: { name: true, address: true, state: true, pitType: true, materialTypes: true } },
      driver:  { include: { user: { select: { name: true, phone: true, email: true } } } },
      carrier: { include: { user: { select: { name: true, phone: true, email: true } } } },
    },
    orderBy: { scheduledDate: "desc" },
    take: 500,
  });

  // ── Revenue totals by category ───────────────────────────────────────────
  const privatePitRevenue = settlements
    .filter((s) => s.order.pit?.pitType !== "QUARRY")
    .reduce((sum, s) => sum + s.commissionCents, 0);

  const quarryRevenue = settlements
    .filter((s) => s.order.pit?.pitType === "QUARRY")
    .reduce((sum, s) => sum + s.commissionCents, 0);

  const driverHaulRevenue = haulOrders
    .filter((o) => o.driverId !== null)
    .reduce((sum, o) => sum + o.platformFeeCents, 0);

  const carrierHaulRevenue = haulOrders
    .filter((o) => o.carrierId !== null)
    .reduce((sum, o) => sum + o.platformFeeCents, 0);

  const totalRevenue = privatePitRevenue + quarryRevenue + driverHaulRevenue + carrierHaulRevenue;

  // ── Material breakdown (pit settlements only — most granular data) ───────
  const materialRevenue: Record<string, number> = {};
  for (const s of settlements) {
    const materials = s.order.loadEvents.map((e) => e.materialType);
    const unique    = [...new Set(materials)];
    const perMat    = unique.length > 0 ? Math.round(s.commissionCents / unique.length) : 0;
    for (const m of unique) {
      materialRevenue[m] = (materialRevenue[m] ?? 0) + perMat;
    }
  }
  const materialRows = Object.entries(materialRevenue).sort((a, b) => b[1] - a[1]);

  // ── Combined transaction log ─────────────────────────────────────────────
  type Row = {
    date:      Date;
    type:      "PIT_PRIVATE" | "PIT_QUARRY" | "DRIVER_HAUL" | "CARRIER_HAUL";
    pitName:   string;
    pitState:  string;
    materials: string[];
    buyer:     { name: string | null; company: string | null; email: string };
    hauler:    { name: string | null; phone: string | null; email: string | null } | null;
    feeCents:  number;
  };

  const rows: Row[] = [
    ...settlements.map((s): Row => ({
      date:      s.createdAt,
      type:      s.order.pit?.pitType === "QUARRY" ? "PIT_QUARRY" : "PIT_PRIVATE",
      pitName:   s.order.pit?.name   ?? "—",
      pitState:  s.order.pit?.state  ?? "—",
      materials: [...new Set(s.order.loadEvents.map((e) => e.materialType))],
      buyer:     { name: s.order.buyer.name, company: s.order.buyer.company, email: s.order.buyer.email },
      hauler:    null,
      feeCents:  s.commissionCents,
    })),
    ...haulOrders.map((o): Row => ({
      date:      o.scheduledDate,
      type:      o.driverId ? "DRIVER_HAUL" : "CARRIER_HAUL",
      pitName:   o.pit?.name  ?? "—",
      pitState:  o.pit?.state ?? "—",
      materials: o.pit?.materialTypes ?? [],
      buyer:     { name: o.buyer.name, company: o.buyer.company, email: o.buyer.email },
      hauler:    o.driver
        ? { name: o.driver.user.name, phone: o.driver.user.phone, email: o.driver.user.email }
        : o.carrier
        ? { name: o.carrier.user.name, phone: o.carrier.user.phone, email: o.carrier.user.email }
        : null,
      feeCents:  o.platformFeeCents,
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  const typeBadge: Record<Row["type"], { label: string; cls: string }> = {
    PIT_PRIVATE:  { label: "Private Pit",  cls: "bg-amber-100 text-amber-800" },
    PIT_QUARRY:   { label: "Quarry",       cls: "bg-stone-100 text-stone-700" },
    DRIVER_HAUL:  { label: "Driver Haul",  cls: "bg-blue-100 text-blue-800" },
    CARRIER_HAUL: { label: "3PL Haul",     cls: "bg-purple-100 text-purple-800" },
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard/admin" className="text-amber-600 text-sm font-medium">← Admin</Link>
        <span className="font-black text-black text-lg">Got Dirt?</span>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-10 space-y-10">
        <h1 className="text-2xl font-bold text-gray-900">Revenue Tracker</h1>

        {/* ── Summary KPIs ── */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-5 text-center sm:col-span-1">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total Revenue</p>
            <p className="text-2xl font-black text-gray-900">{fmt(totalRevenue)}</p>
          </div>
          <div className="bg-white rounded-2xl border border-amber-200 p-5 text-center">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Private Pits</p>
            <p className="text-xl font-bold text-amber-700">{fmt(privatePitRevenue)}</p>
          </div>
          <div className="bg-white rounded-2xl border border-stone-200 p-5 text-center">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Quarries</p>
            <p className="text-xl font-bold text-stone-700">{fmt(quarryRevenue)}</p>
          </div>
          <div className="bg-white rounded-2xl border border-blue-200 p-5 text-center">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Driver Hauls</p>
            <p className="text-xl font-bold text-blue-700">{fmt(driverHaulRevenue)}</p>
          </div>
          <div className="bg-white rounded-2xl border border-purple-200 p-5 text-center">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">3PL Hauls</p>
            <p className="text-xl font-bold text-purple-700">{fmt(carrierHaulRevenue)}</p>
          </div>
        </div>

        {/* ── Revenue share bars ── */}
        {totalRevenue > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
            <h2 className="text-base font-bold text-gray-800">Revenue Mix</h2>
            {[
              { label: "Private Pit Fees",  cents: privatePitRevenue,  cls: "bg-amber-400" },
              { label: "Quarry Fees",        cents: quarryRevenue,      cls: "bg-stone-400" },
              { label: "Driver Haul Fees",   cents: driverHaulRevenue,  cls: "bg-blue-400" },
              { label: "3PL Haul Fees",      cents: carrierHaulRevenue, cls: "bg-purple-400" },
            ].map((row) => {
              const pct = totalRevenue > 0 ? (row.cents / totalRevenue) * 100 : 0;
              return (
                <div key={row.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">{row.label}</span>
                    <span className="font-semibold text-gray-800">{fmt(row.cents)} <span className="text-gray-400 font-normal">({pct.toFixed(1)}%)</span></span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full ${row.cls} rounded-full`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Material breakdown ── */}
        {materialRows.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="text-base font-bold text-gray-800 mb-4">Revenue by Material</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {materialRows.slice(0, 8).map(([mat, cents]) => (
                <div key={mat} className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-500 font-medium truncate">{mat}</p>
                  <p className="text-base font-bold text-gray-800 mt-0.5">{fmt(cents)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Full transaction log ── */}
        <div>
          <h2 className="text-base font-bold text-gray-800 mb-4">
            Transaction Log
            <span className="ml-2 text-sm font-normal text-gray-400">({rows.length} records)</span>
          </h2>

          {rows.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-400">
              No completed revenue transactions yet.
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {["Date", "Type", "Pit / Location", "Material(s)", "Buyer", "Hauler", "Platform Fee"].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.map((row, i) => {
                      const badge = typeBadge[row.type];
                      return (
                        <tr key={i} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 whitespace-nowrap text-gray-500">
                            {row.date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold whitespace-nowrap ${badge.cls}`}>
                              {badge.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-800">{row.pitName}</p>
                            <p className="text-xs text-gray-400">{row.pitState}</p>
                          </td>
                          <td className="px-4 py-3">
                            {row.materials.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {row.materials.slice(0, 3).map((m) => (
                                  <span key={m} className="text-xs bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full">
                                    {m}
                                  </span>
                                ))}
                                {row.materials.length > 3 && (
                                  <span className="text-xs text-gray-400">+{row.materials.length - 3}</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-800">{row.buyer.company ?? row.buyer.name ?? "—"}</p>
                            <p className="text-xs text-gray-400">{row.buyer.email}</p>
                          </td>
                          <td className="px-4 py-3">
                            {row.hauler ? (
                              <>
                                <p className="font-medium text-gray-800">{row.hauler.name ?? "—"}</p>
                                <p className="text-xs text-gray-400">{row.hauler.phone ?? row.hauler.email ?? ""}</p>
                              </>
                            ) : (
                              <span className="text-gray-400 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <p className="font-bold text-green-700 whitespace-nowrap">{fmt(row.feeCents)}</p>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                    <tr>
                      <td colSpan={6} className="px-4 py-3 text-sm font-semibold text-gray-600">Total (shown)</td>
                      <td className="px-4 py-3 text-right font-black text-green-700">
                        {fmt(rows.reduce((s, r) => s + r.feeCents, 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
