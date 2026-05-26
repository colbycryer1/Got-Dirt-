import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { centsToDisplay } from "@/types";

export const metadata = { title: "Project — Got Dirt?" };

const haulStatusColors: Record<string, string> = {
  PENDING:   "bg-amber-100 text-amber-700",
  CONFIRMED: "bg-green-100 text-green-700",
  DENIED:    "bg-red-100 text-red-600",
  ACTIVE:    "bg-blue-100 text-blue-700",
  COMPLETED: "bg-gray-100 text-gray-500",
  CANCELLED: "bg-gray-100 text-gray-400",
};

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const isBuyer = session.user.role === "BUYER" || session.user.role === "CARRIER" || session.user.role === "CONTRACTOR";
  if (!isBuyer && session.user.role !== "ADMIN") redirect("/dashboard");

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      orders: {
        include: {
          pit:         { select: { name: true, state: true } },
          settlements: { orderBy: { date: "desc" }, take: 1 },
          _count:      { select: { loadEvents: true } },
          loadEvents:  { select: { materialType: true }, where: { verified: true } },
        },
        orderBy: { date: "desc" },
      },
      haulOrders: {
        include: {
          pit:     { select: { name: true, state: true } },
          driver:  { include: { user: { select: { name: true } } } },
          carrier: { select: { companyName: true, user: { select: { name: true } } } },
        },
        orderBy: [{ status: "asc" }, { scheduledDate: "asc" }],
      },
      driverAssignments: {
        where:   { active: true },
        include: { driver: { select: { name: true, email: true } } },
      },
    },
  });

  if (!project) notFound();
  if (session.user.role !== "ADMIN" && project.buyerUserId !== session.user.id) notFound();

  // Stats — aggregate across both order types
  const pitLoads       = project.orders.reduce((s, o) => s + o._count.loadEvents, 0);
  const haulLoads      = project.haulOrders
    .filter((o) => o.status === "COMPLETED")
    .reduce((s, o) => s + (o.actualLoads ?? o.loads), 0);
  const totalLoads     = pitLoads + haulLoads;

  const pitSpend       = project.orders.reduce((s, o) => s + (o.settlements[0]?.grossAmountCents ?? 0), 0);
  const haulSpend      = project.haulOrders
    .filter((o) => o.status === "COMPLETED")
    .reduce((s, o) => s + (o.actualLoads != null ? o.actualLoads * o.haulRateCents : o.totalEstimatedCents), 0);
  const totalSpend     = pitSpend + haulSpend;

  const activeHaulOrders = project.haulOrders.filter((o) => ["PENDING", "CONFIRMED", "ACTIVE"].includes(o.status)).length;
  const activeOrders     = project.orders.filter((o) => o.status === "ACTIVE").length + activeHaulOrders;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard/buyer/projects" className="text-amber-600 text-sm font-medium">← Projects</Link>
        <span className="text-gray-300">|</span>
        <Link href="/" className="font-black text-black text-lg">Got Dirt?</Link>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
            {project.location && <p className="text-gray-500 text-sm mt-1">{project.location}</p>}
            {project.description && <p className="text-gray-400 text-sm mt-1">{project.description}</p>}
          </div>
          <div className="flex gap-2 shrink-0">
            <Link
              href={`/dashboard/buyer/projects/${project.id}/edit`}
              className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors"
            >
              Edit
            </Link>
            <Link
              href="/dashboard/buyer/haul-orders/new"
              className="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-amber-700 transition-colors"
            >
              + New Order
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total Loads",    value: totalLoads },
            { label: "Active / Pending", value: activeOrders },
            { label: "Total Spend",    value: totalSpend > 0 ? centsToDisplay(totalSpend) : "—" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl border border-gray-200 p-5 text-center">
              <p className="text-2xl font-black text-gray-900">{s.value}</p>
              <p className="text-sm text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* ── Haul Orders ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-900">Haul Orders</h2>
            <Link href="/dashboard/buyer/haul-orders" className="text-sm text-amber-600 hover:text-amber-700 font-medium">
              View all →
            </Link>
          </div>

          {project.haulOrders.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-gray-400">
              <p className="font-semibold text-gray-600 mb-2">No haul orders yet</p>
              <p className="text-sm mb-4">Create a haul order and link it to this project.</p>
              <Link
                href="/dashboard/buyer/haul-orders/new"
                className="text-amber-600 font-medium hover:underline text-sm"
              >
                + New Haul Order →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {project.haulOrders.map((o) => {
                const isSelfHaul  = o.buyerOperating;
                const haulerName  = isSelfHaul
                  ? "Self-Haul"
                  : o.carrier?.companyName ?? o.carrier?.user.name ?? o.driver?.user.name ?? "Open Broadcast";
                const isCompleted = o.status === "COMPLETED";
                const displayLoads = isCompleted ? (o.actualLoads ?? o.loads) : o.loads;
                const displayAmount = isCompleted && o.actualLoads != null
                  ? o.actualLoads * o.haulRateCents
                  : o.totalEstimatedCents;

                return (
                  <div key={o.id} className="bg-white rounded-2xl border border-gray-200 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-gray-900 text-sm">{haulerName}</p>
                          {isSelfHaul && (
                            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Self</span>
                          )}
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${haulStatusColors[o.status] ?? "bg-gray-100 text-gray-600"}`}>
                            {o.status}
                          </span>
                        </div>
                        {o.pit && (
                          <p className="text-xs text-gray-500">{o.pit.name} · {o.pit.state}</p>
                        )}
                        <p className="text-xs text-gray-400">
                          {new Date(o.scheduledDate).toLocaleDateString("en-US", {
                            weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                          })}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-gray-900 text-sm">
                          {displayLoads} load{displayLoads !== 1 ? "s" : ""}
                        </p>
                        <p className="text-xs text-gray-400">
                          {isCompleted ? "" : "~"}${(displayAmount / 100).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Pit Material Orders ── */}
        {project.orders.length > 0 && (
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-3">Pit Orders</h2>
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {["Date", "Pit", "Materials", "Loads", "Settlement", "Status"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {project.orders.map((o) => {
                    const settle = o.settlements[0];
                    const materialCounts = o.loadEvents.reduce<Record<string, number>>((acc, e) => {
                      acc[e.materialType] = (acc[e.materialType] ?? 0) + 1;
                      return acc;
                    }, {});
                    return (
                      <tr key={o.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                          {new Date(o.date).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900">{o.pit.name}</td>
                        <td className="px-4 py-3">
                          {Object.keys(materialCounts).length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {Object.entries(materialCounts).map(([mat, cnt]) => (
                                <span key={mat} className="text-xs bg-stone-100 text-stone-700 border border-stone-200 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
                                  {mat} × {cnt}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">
                            {o._count.loadEvents}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {settle ? centsToDisplay(settle.grossAmountCents) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={o.status} settlementStatus={settle?.status} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* No orders at all */}
        {project.orders.length === 0 && project.haulOrders.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <p className="text-4xl mb-4">📋</p>
            <p className="font-semibold text-gray-700 mb-2">No orders yet</p>
            <p className="text-sm text-gray-400 mb-6">Create a haul order and assign it to this project to start tracking loads.</p>
            <Link
              href="/dashboard/buyer/haul-orders/new"
              className="bg-amber-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-amber-700 transition-colors"
            >
              + New Haul Order
            </Link>
          </div>
        )}

        {/* Accounting fields */}
        {(project.costCode || project.externalJobCode || project.glAccountCode) && (
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-3">Accounting</h2>
            <div className="bg-white rounded-2xl border border-gray-200 p-5 grid sm:grid-cols-3 gap-4 text-sm">
              {project.externalJobCode && (
                <div><p className="text-xs text-gray-400 mb-0.5">Job Number</p><p className="font-medium text-gray-900">{project.externalJobCode}</p></div>
              )}
              {project.costCode && (
                <div><p className="text-xs text-gray-400 mb-0.5">Cost Code</p><p className="font-medium text-gray-900">{project.costCode}</p></div>
              )}
              {project.glAccountCode && (
                <div><p className="text-xs text-gray-400 mb-0.5">GL Account</p><p className="font-medium text-gray-900">{project.glAccountCode}</p></div>
              )}
            </div>
          </div>
        )}

        {/* Assigned drivers */}
        {project.driverAssignments.length > 0 && (
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-3">Assigned Drivers</h2>
            <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
              {project.driverAssignments.map((a) => (
                <div key={a.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{a.driver.name ?? "—"}</p>
                    <p className="text-sm text-gray-400">{a.driver.email}</p>
                  </div>
                  <span className="text-xs text-sky-600 font-semibold bg-sky-50 px-2 py-0.5 rounded-full">Active</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

function StatusBadge({ status, settlementStatus }: { status: string; settlementStatus?: string }) {
  if (status === "CANCELLED") return <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Cancelled</span>;
  if (settlementStatus === "PROCESSED") return <span className="text-xs font-medium text-sky-700 bg-sky-100 px-2 py-0.5 rounded-full">Settled</span>;
  if (settlementStatus === "FAILED") return <span className="text-xs font-medium text-red-700 bg-red-100 px-2 py-0.5 rounded-full">Failed</span>;
  if (status === "ACTIVE") return <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">Active</span>;
  return <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{status}</span>;
}
