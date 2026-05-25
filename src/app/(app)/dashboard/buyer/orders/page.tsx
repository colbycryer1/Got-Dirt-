import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import CloseOrderButton from "./CloseOrderButton";

export const metadata = { title: "Order History — Got Dirt?" };

const statusStyles: Record<string, string> = {
  ACTIVE:    "bg-green-100 text-green-700",
  COMPLETED: "bg-gray-100 text-gray-600",
  CANCELLED: "bg-red-100 text-red-600",
};

export default async function OrderHistoryPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const orders = await prisma.order.findMany({
    where:   { buyerUserId: session.user.id },
    include: {
      pit:     { select: { name: true, address: true, state: true } },
      project: { select: { name: true } },
      _count:  { select: { loadEvents: true } },
      settlements: {
        select: { grossAmountCents: true, verifiedLoadCount: true, status: true },
      },
    },
    orderBy: { date: "desc" },
  });

  const totalSpent = orders.flatMap((o) => o.settlements)
    .filter((s) => s.status === "PROCESSED")
    .reduce((sum, s) => sum + s.grossAmountCents, 0);

  const totalLoads = orders.reduce((sum, o) => sum + o._count.loadEvents, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard/buyer" className="text-amber-600 hover:text-amber-700 text-sm font-medium">
          ← Dashboard
        </Link>
        <span className="text-gray-300">|</span>
        <Link href="/" className="font-black text-black text-lg">Got Dirt?</Link>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10 space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Order History</h1>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total Orders", value: orders.length },
            { label: "Total Loads", value: totalLoads },
            { label: "Total Spent", value: `$${(totalSpent / 100).toFixed(2)}` },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl border border-gray-200 p-5 text-center">
              <p className="text-2xl font-black text-gray-900">{s.value}</p>
              <p className="text-sm text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Orders list */}
        {orders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <p className="text-gray-500 font-medium mb-2">No orders yet</p>
            <p className="text-sm text-gray-400 mb-4">Find a pit and place your first order.</p>
            <Link href="/map" className="bg-amber-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-amber-700">
              Find Pits →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => {
              const spent = order.settlements
                .filter((s) => s.status === "PROCESSED")
                .reduce((sum, s) => sum + s.grossAmountCents, 0);

              return (
                <div key={order.id} className="bg-white rounded-2xl border border-gray-200 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-gray-900">{order.pit.name}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${statusStyles[order.status] ?? "bg-gray-100 text-gray-600"}`}>
                          {order.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {order.project.name} · {order.pit.address ? `${order.pit.address}, ` : ""}{order.pit.state}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(order.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-bold text-gray-900">${(spent / 100).toFixed(2)}</p>
                      <p className="text-xs text-gray-400">{order._count.loadEvents} load{order._count.loadEvents !== 1 ? "s" : ""}</p>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex gap-4 text-xs text-gray-500">
                      {order.settlements.length > 0 && (
                        <>
                          <span>{order.settlements.length} settlement{order.settlements.length !== 1 ? "s" : ""}</span>
                          <span>{order.settlements.filter((s) => s.status === "PROCESSED").length} processed</span>
                        </>
                      )}
                    </div>
                    {order.status === "ACTIVE" && (
                      <CloseOrderButton orderId={order.id} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
