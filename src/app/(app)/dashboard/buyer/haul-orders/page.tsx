import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isBuyerRole } from "@/types";
import CompleteHaulButton from "./CompleteHaulButton";
import { getPitOwnerLoadLogCounts } from "@/lib/haul-load-log";

export const metadata = { title: "Haul Orders — Got Dirt?" };

const statusColors: Record<string, string> = {
  PENDING:   "bg-amber-100 text-amber-700",
  CONFIRMED: "bg-green-100 text-green-700",
  DENIED:    "bg-red-100 text-red-600",
  ACTIVE:    "bg-blue-100 text-blue-700",
  COMPLETED: "bg-gray-100 text-gray-500",
  CANCELLED: "bg-gray-100 text-gray-400",
};

export default async function BuyerHaulOrdersPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (!isBuyerRole(session.user.role) && session.user.role !== "ADMIN") redirect("/dashboard");

  const role = session.user.role;

  // Buyers see orders they placed; carriers also see orders assigned to them as a carrier
  const [placedOrders, incomingOrders] = await Promise.all([
    prisma.haulOrder.findMany({
      where:   { buyerUserId: session.user.id },
      include: {
        driver:  { include: { user: { select: { name: true, phone: true } } } },
        carrier: { include: { user: { select: { name: true, phone: true } } } },
        pit:     { select: { name: true, state: true } },
        project: { select: { name: true } },
        amendments: {
          where:   { status: { in: ["PENDING", "APPROVED"] } },
          orderBy: { createdAt: "desc" },
          take:    1,
          select:  { status: true, requestedLoads: true, haulerApproved: true, pitOwnerApproved: true },
        },
      },
      orderBy: [{ status: "asc" }, { scheduledDate: "asc" }],
    }),
    role === "CARRIER"
      ? prisma.haulOrder.findMany({
          where:   { carrier: { userId: session.user.id } },
          include: {
            buyer:   { select: { name: true, company: true, phone: true } },
            pit:     { select: { name: true, state: true } },
            project: { select: { name: true } },
          },
          orderBy: [{ status: "asc" }, { scheduledDate: "asc" }],
        })
      : Promise.resolve([]),
  ]);

  const activePlaced    = placedOrders.filter((o) => ["PENDING", "CONFIRMED", "ACTIVE"].includes(o.status));
  const completedPlaced = placedOrders.filter((o) => ["COMPLETED", "DENIED", "CANCELLED"].includes(o.status));
  const activeIncoming  = incomingOrders.filter((o) => ["PENDING", "CONFIRMED", "ACTIVE"].includes(o.status));

  // Live load log counts — from PitOwnerLoadLog so buyer sees pit operator's authoritative tap count
  const loadLogCounts = await getPitOwnerLoadLogCounts(activePlaced.map((o) => o.id));

  const totalChargedCents = placedOrders
    .filter((o) => o.status === "COMPLETED")
    .reduce((sum, o) => sum + (o.actualLoads != null ? o.actualLoads * o.haulRateCents : o.totalEstimatedCents), 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard/buyer" className="text-amber-600 hover:text-amber-700 text-sm font-medium">← Dashboard</Link>
        <span className="text-gray-300">|</span>
        <Link href="/" className="font-black text-black text-lg">Got Dirt?</Link>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Haul Orders</h1>
          <Link href="/dashboard/buyer/haul-orders/new"
            className="bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-amber-700">
            + New Haul Order
          </Link>
        </div>

        {/* Summary stats */}
        {placedOrders.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Total Orders",    value: placedOrders.length },
              { label: "Active / Pending", value: activePlaced.length },
              { label: "Total Charged",   value: `$${(totalChargedCents / 100).toFixed(2)}` },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-2xl border border-gray-200 p-5 text-center">
                <p className="text-2xl font-black text-gray-900">{s.value}</p>
                <p className="text-sm text-gray-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Carrier incoming requests */}
        {role === "CARRIER" && activeIncoming.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Incoming Requests (Carrier)
            </h2>
            <div className="space-y-3">
              {activeIncoming.map((o) => (
                <IncomingOrderRow key={o.id} order={o as IncomingOrder} />
              ))}
            </div>
          </section>
        )}

        {placedOrders.length === 0 && incomingOrders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <p className="text-gray-500 font-medium mb-2">No haul orders yet</p>
            <p className="text-sm text-gray-400 mb-4">Find a nearby driver or carrier on the map and schedule a haul.</p>
            <Link href="/map" className="bg-amber-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-amber-700">
              Open Map →
            </Link>
          </div>
        ) : (
          <>
            {activePlaced.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Active & Upcoming</h2>
                <div className="space-y-3">
                  {activePlaced.map((o) => (
                    <PlacedOrderRow key={o.id} order={o as PlacedOrder} statusColors={statusColors} logCount={loadLogCounts[o.id]} />
                  ))}
                </div>
              </section>
            )}
            {completedPlaced.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Completed & Cancelled</h2>
                <div className="space-y-3">
                  {completedPlaced.map((o) => (
                    <PlacedOrderRow key={o.id} order={o as PlacedOrder} statusColors={statusColors} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Types for row components ──────────────────────────────────────────────

interface PlacedOrder {
  id: string;
  status: string;
  scheduledDate: Date;
  createdAt: Date;
  loads: number;
  actualLoads: number | null;
  haulRateCents: number;
  totalEstimatedCents: number;
  notes: string | null;
  driverId: string | null;
  carrierId: string | null;
  buyerOperating: boolean;
  driver:  { truckType: string | null; user: { name: string | null; phone: string | null } } | null;
  carrier: { companyName: string | null; user: { name: string | null; phone: string | null } } | null;
  pit:     { name: string; state: string } | null;
  project: { name: string } | null;
  amendments: Array<{
    status: string;
    requestedLoads: number;
    haulerApproved: boolean | null;
    pitOwnerApproved: boolean | null;
  }>;
}

interface IncomingOrder {
  id: string;
  status: string;
  scheduledDate: Date;
  loads: number;
  haulRateCents: number;
  totalEstimatedCents: number;
  notes: string | null;
  buyer:   { name: string | null; company: string | null; phone: string | null };
  pit:     { name: string; state: string } | null;
  project: { name: string } | null;
}

function PlacedOrderRow({ order, statusColors, logCount }: { order: PlacedOrder; statusColors: Record<string, string>; logCount?: number }) {
  const isSelfHaul = order.buyerOperating;
  const haulerName = isSelfHaul
    ? "Self-Haul (Buyer/Operator)"
    : order.carrier?.companyName
    ?? order.carrier?.user.name
    ?? order.driver?.user.name
    ?? ((!order.driverId && !order.carrierId) ? "Open Broadcast" : "Unknown");

  const haulerType = isSelfHaul ? "Self" : order.carrier ? "3PL" : order.driver ? "Driver" : "Broadcast";
  const canComplete  = !isSelfHaul && (order.status === "CONFIRMED" || order.status === "ACTIVE");
  const canEdit      = ["PENDING", "CONFIRMED"].includes(order.status) && order.scheduledDate > new Date();

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-gray-900">{haulerName}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full ${isSelfHaul ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-500"}`}>{haulerType}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${statusColors[order.status] ?? "bg-gray-100 text-gray-600"}`}>
              {order.status}
            </span>
            {canEdit && (
              <a href={`/dashboard/buyer/haul-orders/${order.id}/edit`}
                className="text-xs text-amber-600 hover:text-amber-700 font-semibold">
                Edit
              </a>
            )}
          </div>
          {order.driver?.truckType && <p className="text-sm text-gray-500 mt-0.5">{order.driver.truckType}</p>}
          {order.pit && <p className="text-sm text-gray-500">{order.pit.name} · {order.pit.state}</p>}
          {order.project && <p className="text-xs text-gray-400">{order.project.name}</p>}
          <p className="text-xs text-gray-400 mt-1">
            {new Date(order.scheduledDate).toLocaleDateString("en-US", {
              weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
            })}
          </p>
        </div>
        <div className="text-right shrink-0">
          {order.status === "COMPLETED" && order.actualLoads != null ? (
            <>
              <p className="text-lg font-bold text-gray-900">
                ${((order.actualLoads * order.haulRateCents) / 100).toFixed(2)}
              </p>
              <p className="text-xs text-gray-400">
                {order.actualLoads} actual load{order.actualLoads !== 1 ? "s" : ""} @ ${(order.haulRateCents / 100).toFixed(2)}
              </p>
              {order.actualLoads !== order.loads && (
                <p className="text-xs text-gray-400 line-through">
                  Est. {order.loads} loads (${(order.totalEstimatedCents / 100).toFixed(2)})
                </p>
              )}
            </>
          ) : (
            <>
              <p className="text-lg font-bold text-gray-900">${(order.totalEstimatedCents / 100).toFixed(2)}</p>
              <p className="text-xs text-gray-400">{order.loads} load{order.loads !== 1 ? "s" : ""} @ ${(order.haulRateCents / 100).toFixed(2)}</p>
            </>
          )}
        </div>
      </div>
      {/* Live load log count — updates automatically as pit operator logs loads */}
      {logCount !== undefined && order.pit && (
        <div className={`mt-2 rounded-xl px-4 py-2.5 text-xs flex items-center gap-2 ${logCount > 0 ? "bg-blue-50 text-blue-700" : "bg-gray-50 text-gray-500"}`}>
          <span className={`w-2 h-2 rounded-full shrink-0 ${logCount > 0 ? "bg-blue-500 animate-pulse" : "bg-gray-300"}`} />
          {logCount > 0
            ? `Load Log: ${logCount} load${logCount !== 1 ? "s" : ""} recorded at ${order.pit.name} — updates automatically`
            : `No loads logged yet at ${order.pit.name} — updates when pit operator records`}
          {logCount !== order.loads && logCount > 0 && (
            <span className={`ml-auto font-semibold ${logCount > order.loads ? "text-amber-700" : "text-green-700"}`}>
              {logCount > order.loads ? `+${logCount - order.loads} over estimate` : `${order.loads - logCount} under estimate`}
            </span>
          )}
        </div>
      )}

      {/* Contact info for confirmed orders */}
      {order.status === "CONFIRMED" && (
        <div className="mt-3 pt-3 border-t border-gray-100 flex gap-4 flex-wrap text-xs text-gray-500">
          {(order.driver?.user.phone ?? order.carrier?.user.phone) && (
            <span>📞 {order.driver?.user.phone ?? order.carrier?.user.phone}</span>
          )}
        </div>
      )}

      {canComplete && (
        <div className="mt-4 pt-3 border-t border-gray-100 space-y-2">
          {/* Amendment status badge */}
          {order.amendments.length > 0 && order.amendments[0].status === "PENDING" && (
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
              <span className="text-xs font-semibold text-amber-700">
                Amendment Pending — {order.amendments[0].requestedLoads} loads requested
              </span>
            </div>
          )}
          {order.amendments.length > 0 && order.amendments[0].status === "APPROVED" && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-green-700">
                ✓ Amendment Approved — {order.amendments[0].requestedLoads} loads
              </span>
            </div>
          )}
          <CompleteHaulButton
            orderId={order.id}
            estimatedLoads={order.loads}
            haulRateCents={order.haulRateCents}
            createdAt={order.createdAt.toISOString()}
          />
        </div>
      )}
    </div>
  );
}

function IncomingOrderRow({ order }: { order: IncomingOrder }) {
  return (
    <div className="bg-white rounded-2xl border border-amber-200 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-bold text-gray-900">{order.buyer.company ?? order.buyer.name ?? "Buyer"}</p>
          {order.pit && <p className="text-sm text-gray-500">{order.pit.name} · {order.pit.state}</p>}
          {order.project && <p className="text-xs text-gray-400">{order.project.name}</p>}
          <p className="text-xs text-gray-400 mt-1">
            {new Date(order.scheduledDate).toLocaleDateString("en-US", {
              weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
            })}
          </p>
        </div>
        <div className="text-right shrink-0">
          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${statusColors[order.status] ?? "bg-gray-100 text-gray-600"}`}>
            {order.status}
          </span>
          <p className="text-lg font-bold text-gray-900 mt-1">${(order.totalEstimatedCents / 100).toFixed(2)}</p>
          <p className="text-xs text-gray-400">{order.loads} load{order.loads !== 1 ? "s" : ""}</p>
        </div>
      </div>
    </div>
  );
}
