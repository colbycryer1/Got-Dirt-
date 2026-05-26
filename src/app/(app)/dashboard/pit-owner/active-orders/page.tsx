import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import PitOwnerOrderActions from "./PitOwnerOrderActions";
import OnSitePanel from "./OnSitePanel";
import PitOwnerAmendmentRespondForm from "../amendments/PitOwnerAmendmentRespondForm";

export const metadata = { title: "Active Orders — Got Dirt?" };

const haulStatusColors: Record<string, string> = {
  PENDING:   "bg-amber-100 text-amber-700",
  CONFIRMED: "bg-green-100 text-green-700",
  ACTIVE:    "bg-blue-100 text-blue-700",
  COMPLETED: "bg-gray-100 text-gray-500",
  CANCELLED: "bg-gray-100 text-gray-400",
  DENIED:    "bg-red-100 text-red-700",
};

export default async function PitOwnerActiveOrdersPage() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== "PIT_OWNER" && session.user.role !== "ADMIN")) {
    redirect("/dashboard");
  }

  const pits = await prisma.pit.findMany({
    where:  { ownerId: session.user.id, status: "ACTIVE" },
    select: { id: true, name: true, state: true },
  });
  const pitIds = pits.map((p) => p.id);

  // All open haul orders at owner's pits (excluding truly closed ones)
  const haulOrders = pitIds.length > 0
    ? await prisma.haulOrder.findMany({
        where:   { pitId: { in: pitIds }, status: { notIn: ["COMPLETED", "CANCELLED"] } },
        include: {
          pit:     { select: { name: true, state: true } },
          buyer:   { select: { name: true, company: true, phone: true } },
          driver:  { include: { user: { select: { name: true, phone: true } } } },
          carrier: { select: { companyName: true, user: { select: { name: true, phone: true } } } },
          project: { select: { name: true } },
        },
        orderBy: { scheduledDate: "asc" },
      })
    : [];

  // Active pit material orders
  const matOrders = pitIds.length > 0
    ? await prisma.order.findMany({
        where:   { pitId: { in: pitIds }, status: "ACTIVE" },
        include: {
          pit:     { select: { name: true, state: true } },
          buyer:   { select: { name: true, company: true, phone: true, email: true } },
          project: { select: { name: true } },
          _count:  { select: { loadEvents: true } },
        },
        orderBy: { date: "desc" },
      })
    : [];

  // Pending amendments on accepted haul orders — pit owner must approve/deny
  const pendingAmendments = pitIds.length > 0
    ? await prisma.haulOrderAmendment.findMany({
        where: {
          status:           "PENDING",
          pitOwnerApproved: null,
          haulOrder:        { pitId: { in: pitIds } },
        },
        include: {
          haulOrder: {
            include: {
              pit:     { select: { name: true, state: true } },
              buyer:   { select: { name: true, company: true } },
              driver:  { include: { user: { select: { name: true } } } },
              carrier: { select: { companyName: true } },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      })
    : [];

  // Recent closed haul orders for history
  const closedHaulOrders = pitIds.length > 0
    ? await prisma.haulOrder.findMany({
        where:   { pitId: { in: pitIds }, status: { in: ["COMPLETED", "CANCELLED", "DENIED"] } },
        include: {
          pit:     { select: { name: true } },
          buyer:   { select: { name: true, company: true } },
          driver:  { include: { user: { select: { name: true } } } },
          carrier: { select: { companyName: true } },
        },
        orderBy: { updatedAt: "desc" },
        take:    10,
      })
    : [];

  // Split haulOrders into categories
  const pendingOrders   = haulOrders.filter((o) => o.pitOwnerApproved === null && o.status !== "DENIED");
  const acceptedOrders  = haulOrders.filter((o) => o.pitOwnerApproved === true);
  const buyerOpOrders   = haulOrders.filter((o) => o.buyerOperating === true);

  // Build shape for OnSitePanel
  const acceptedOrdersForPanel = acceptedOrders.map((o) => ({
    id:               o.id,
    driverId:         o.driverId,
    loads:            o.loads,
    status:           o.status,
    buyerName:        o.buyer.company ?? o.buyer.name ?? "Buyer",
    haulerName:       o.carrier?.companyName ?? o.carrier?.user.name ?? o.driver?.user.name ?? "Open Broadcast",
    pitName:          o.pit?.name ?? "—",
    pitId:            o.pitId ?? "",
    scheduledDateStr: new Date(o.scheduledDate).toLocaleDateString("en-US", {
      weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    }),
    pitOwnerApproved: o.pitOwnerApproved,
  }));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard/pit-owner" className="text-amber-600 hover:text-amber-700 text-sm font-medium">
          ← Dashboard
        </Link>
        <span className="text-gray-300">|</span>
        <Link href="/" className="font-black text-black text-lg">Got Dirt?</Link>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">
        <h1 className="text-2xl font-bold text-gray-900">Active Orders</h1>

        {/* Amendment alert banner */}
        {pendingAmendments.length > 0 && (
          <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 flex items-start gap-3">
            <span className="text-xl mt-0.5">⚠️</span>
            <div>
              <p className="font-bold text-amber-800">
                {pendingAmendments.length} Amendment{pendingAmendments.length !== 1 ? "s" : ""} Awaiting Your Approval
              </p>
              <p className="text-sm text-amber-700 mt-0.5">
                A buyer has requested extra loads. Review and approve or deny below before haul completion can proceed.
              </p>
            </div>
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Pending Review",  value: pendingOrders.length },
            { label: "Active Haul",     value: acceptedOrders.length + buyerOpOrders.length },
            { label: "Pit Material",    value: matOrders.length },
            { label: "Amendments",      value: pendingAmendments.length, highlight: pendingAmendments.length > 0 },
          ].map((s) => (
            <div key={s.label} className={`rounded-2xl border p-5 text-center ${
              "highlight" in s && s.highlight
                ? "bg-amber-50 border-amber-300"
                : "bg-white border-gray-200"
            }`}>
              <p className={`text-2xl font-black ${"highlight" in s && s.highlight ? "text-amber-700" : "text-gray-900"}`}>
                {s.value}
              </p>
              <p className="text-sm text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* ── SECTION: Pending Review ─────────────────────────────────── */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Pending Review ({pendingOrders.length})
          </h2>

          {pendingOrders.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center text-gray-400">
              <p className="text-sm">No orders awaiting review</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingOrders.map((o) => {
                const haulerName = o.carrier?.companyName ?? o.carrier?.user.name ?? o.driver?.user.name ?? "Open Broadcast";
                const haulerPhone = o.driver?.user.phone ?? o.carrier?.user.phone;
                return (
                  <div key={o.id} className="bg-amber-50 rounded-2xl border border-amber-200 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="font-bold text-gray-900">{o.buyer.company ?? o.buyer.name ?? "Buyer"}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${haulStatusColors[o.status] ?? "bg-gray-100 text-gray-600"}`}>
                            {o.status}
                          </span>
                          <span className="text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-semibold">
                            Awaiting Review
                          </span>
                        </div>
                        <p className="text-sm text-gray-500">{o.pit?.name ?? "—"} · {o.pit?.state ?? ""}</p>
                        <p className="text-xs text-gray-400">Hauler: {haulerName}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(o.scheduledDate).toLocaleDateString("en-US", {
                            weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                          })}
                        </p>
                        <div className="flex gap-3 mt-1 text-xs text-gray-500">
                          {o.buyer.phone && <span>📞 Buyer: {o.buyer.phone}</span>}
                          {haulerPhone   && <span>🚛 Hauler: {haulerPhone}</span>}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">Est. {o.loads} loads</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-lg font-bold text-gray-900">{o.loads}</p>
                        <p className="text-xs text-gray-400">est. loads</p>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-amber-200">
                      <PitOwnerOrderActions orderId={o.id} pitId={o.pitId ?? ""} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── SECTION: Pending Amendments ────────────────────────────── */}
        {pendingAmendments.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Amendments Requiring Your Approval ({pendingAmendments.length})
            </h2>
            <div className="space-y-4">
              {pendingAmendments.map((amendment) => {
                const order      = amendment.haulOrder;
                const buyerName  = order.buyer.company ?? order.buyer.name ?? "Buyer";
                const haulerName = order.carrier?.companyName ?? order.driver?.user.name ?? "Hauler";
                const extraLoads = amendment.requestedLoads - amendment.originalLoads;
                const fmt = (cents: number) =>
                  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

                return (
                  <div key={amendment.id} className="bg-white rounded-2xl border-2 border-amber-300 p-5 space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="inline-block w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                          <p className="font-bold text-gray-900">{buyerName}</p>
                          <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-semibold">
                            Load Amendment
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mt-0.5">
                          {order.pit?.name ?? "—"} · {order.pit?.state ?? ""}
                        </p>
                        <p className="text-xs text-gray-400">Hauler: {haulerName}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Scheduled:{" "}
                          {new Date(order.scheduledDate).toLocaleDateString("en-US", {
                            weekday: "short", month: "short", day: "numeric",
                          })}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-gray-900">
                          {amendment.originalLoads} → {amendment.requestedLoads} loads
                        </p>
                        <p className="text-xs text-amber-600 font-semibold">
                          +{extraLoads} extra ({fmt(extraLoads * order.haulRateCents)})
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          @ {fmt(order.haulRateCents)}/load
                        </p>
                      </div>
                    </div>

                    {amendment.reason && (
                      <div className="bg-gray-50 rounded-xl px-4 py-2.5 text-sm text-gray-600">
                        <span className="font-semibold text-gray-500 text-xs">Buyer note: </span>
                        {amendment.reason}
                      </div>
                    )}

                    <div className="pt-1 space-y-2">
                      <p className="text-xs text-gray-500">
                        Hauler:{" "}
                        {amendment.haulerApproved === null
                          ? "Awaiting response"
                          : amendment.haulerApproved
                          ? "✓ Approved"
                          : "✗ Denied"}
                      </p>
                      <PitOwnerAmendmentRespondForm
                        orderId={order.id}
                        amendmentId={amendment.id}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── SECTION: Accepted Haul Orders + On-Site detection ──────── */}
        <OnSitePanel orders={acceptedOrdersForPanel} pitIds={pitIds} />

        {/* ── SECTION: Buyer/Operator (Self-Haul) ────────────────────── */}
        {buyerOpOrders.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Buyer/Operator (Self-Haul) ({buyerOpOrders.length})
            </h2>
            <div className="space-y-3">
              {buyerOpOrders.map((o) => (
                <div key={o.id} className="bg-white rounded-2xl border border-amber-300 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-gray-900">{o.buyer.company ?? o.buyer.name ?? "Buyer"}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${haulStatusColors[o.status] ?? "bg-gray-100 text-gray-600"}`}>
                          {o.status}
                        </span>
                        <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-semibold">
                          Pit Payment Due
                        </span>
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
                          Self-Haul
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">{o.pit?.name ?? "—"} · {o.pit?.state ?? ""}</p>
                      {o.operatorTruckType && (
                        <p className="text-xs text-gray-400">Truck: {o.operatorTruckType}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(o.scheduledDate).toLocaleDateString("en-US", {
                          weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                        })}
                      </p>
                      {o.buyer.phone && (
                        <p className="text-xs text-gray-500 mt-1">📞 {o.buyer.phone}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-bold text-gray-900">{o.loads}</p>
                      <p className="text-xs text-gray-400">est. loads</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── SECTION: Active Pit Material Orders ────────────────────── */}
        {matOrders.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Active Pit Orders ({matOrders.length})
            </h2>
            <div className="space-y-3">
              {matOrders.map((o) => (
                <div key={o.id} className="bg-white rounded-2xl border border-green-200 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-gray-900">{o.buyer.company ?? o.buyer.name ?? "Buyer"}</p>
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">ACTIVE</span>
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">{o.pit.name} · {o.pit.state}</p>
                      <p className="text-xs text-gray-400">{o.project.name}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(o.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                      </p>
                      <div className="flex gap-3 mt-1 text-xs text-gray-500">
                        {o.buyer.phone && <span>📞 {o.buyer.phone}</span>}
                        {o.buyer.email && <span>✉️ {o.buyer.email}</span>}
                      </div>
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

        {/* ── SECTION: Recent History ─────────────────────────────────── */}
        {closedHaulOrders.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Recent History
            </h2>
            <div className="space-y-2">
              {closedHaulOrders.map((o) => {
                const haulerName = o.carrier?.companyName ?? o.driver?.user.name ?? "—";
                return (
                  <div key={o.id} className="bg-white rounded-xl border border-gray-200 px-5 py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {o.buyer.company ?? o.buyer.name} → {haulerName}
                      </p>
                      <p className="text-xs text-gray-400">
                        {o.pit?.name} · {new Date(o.scheduledDate).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-semibold text-gray-600">{o.actualLoads ?? o.loads} loads</p>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${haulStatusColors[o.status] ?? "text-gray-400"}`}>
                        {o.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Empty state */}
        {pendingOrders.length === 0 &&
          acceptedOrders.length === 0 &&
          buyerOpOrders.length === 0 &&
          matOrders.length === 0 &&
          closedHaulOrders.length === 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-400">
              <p className="font-semibold text-gray-600 mb-1">No orders at your pits yet</p>
              <p className="text-sm">Buyers place orders when they need to pick up or drop off material.</p>
            </div>
          )}
      </div>
    </div>
  );
}
