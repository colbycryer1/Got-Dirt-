import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isBuyerRole } from "@/types";

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

  const orders = await prisma.haulOrder.findMany({
    where:   { buyerUserId: session.user.id },
    include: {
      driver:  {
        include: { user: { select: { name: true, phone: true } } },
      },
      carrier: {
        include: { user: { select: { name: true, phone: true } } },
      },
      pit:     { select: { name: true, state: true } },
      project: { select: { name: true } },
    },
    orderBy: [{ status: "asc" }, { scheduledDate: "asc" }],
  });

  const active    = orders.filter((o) => ["PENDING", "CONFIRMED", "ACTIVE"].includes(o.status));
  const completed = orders.filter((o) => ["COMPLETED", "DENIED", "CANCELLED"].includes(o.status));

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

        {orders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <p className="text-gray-500 font-medium mb-2">No haul orders yet</p>
            <p className="text-sm text-gray-400 mb-4">Find a nearby driver or carrier on the map and schedule a haul.</p>
            <Link href="/map" className="bg-amber-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-amber-700">
              Open Map →
            </Link>
          </div>
        ) : (
          <>
            {active.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Active & Upcoming</h2>
                <div className="space-y-3">
                  {active.map((o) => <HaulOrderRow key={o.id} order={o} />)}
                </div>
              </section>
            )}
            {completed.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Completed & Cancelled</h2>
                <div className="space-y-3">
                  {completed.map((o) => <HaulOrderRow key={o.id} order={o} />)}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function HaulOrderRow({ order }: {
  order: {
    id: string;
    status: string;
    scheduledDate: Date;
    loads: number;
    haulRateCents: number;
    totalEstimatedCents: number;
    notes: string | null;
    driver:  { truckType: string | null; user: { name: string | null; phone: string | null } } | null;
    carrier: { companyName: string | null; user: { name: string | null; phone: string | null } } | null;
    pit:     { name: string; state: string } | null;
    project: { name: string } | null;
  };
}) {
  const haulerName = order.carrier?.companyName
    ?? order.carrier?.user.name
    ?? order.driver?.user.name
    ?? "Unknown";

  const haulerType = order.carrier ? "3PL" : "Driver";

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-gray-900">{haulerName}</p>
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{haulerType}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${statusColors[order.status] ?? "bg-gray-100 text-gray-600"}`}>
              {order.status}
            </span>
          </div>
          {order.driver?.truckType && <p className="text-sm text-gray-500 mt-0.5">{order.driver.truckType}</p>}
          {order.pit && <p className="text-sm text-gray-500">{order.pit.name} · {order.pit.state}</p>}
          {order.project && <p className="text-xs text-gray-400">{order.project.name}</p>}
          <p className="text-xs text-gray-400 mt-1">
            {new Date(order.scheduledDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-bold text-gray-900">${(order.totalEstimatedCents / 100).toFixed(2)}</p>
          <p className="text-xs text-gray-400">{order.loads} load{order.loads !== 1 ? "s" : ""} @ ${(order.haulRateCents / 100).toFixed(2)}</p>
        </div>
      </div>
    </div>
  );
}
