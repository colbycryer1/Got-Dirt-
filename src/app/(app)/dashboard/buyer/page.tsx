import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function BuyerDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const role = session.user.role;
  if (role !== "BUYER" && role !== "CONTRACTOR" && role !== "CARRIER") redirect("/dashboard");

  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);

  const [user, projects, activeOrders, recentActivity, totalSpent] = await Promise.all([
    prisma.user.findUnique({
      where:  { id: session.user.id },
      select: { name: true, company: true },
    }),
    prisma.project.findMany({
      where:   { buyerUserId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 4,
      include: { _count: { select: { orders: true } } },
    }),
    prisma.order.findMany({
      where:   { buyerUserId: session.user.id, status: "ACTIVE" },
      include: {
        pit:     { select: { name: true, state: true } },
        project: { select: { name: true } },
        _count:  { select: { loadEvents: true } },
      },
      orderBy: { date: "desc" },
      take: 10,
    }),
    // Recent verified load events across all buyer's orders
    prisma.loadEvent.findMany({
      where: {
        order:    { buyerUserId: session.user.id },
        verified: true,
        exitTime: { gte: sevenDaysAgo },
      },
      include: {
        pit:   { select: { name: true } },
        order: { select: { project: { select: { name: true } } } },
      },
      orderBy: { exitTime: "desc" },
      take: 15,
    }),
    // Total spent from settlements
    prisma.settlement.aggregate({
      where:  { order: { buyerUserId: session.user.id }, status: "PROCESSED" },
      _sum:   { grossAmountCents: true },
    }),
  ]);

  const totalLoads = activeOrders.reduce((s, o) => s + o._count.loadEvents, 0);
  const spentCents = totalSpent._sum.grossAmountCents ?? 0;
  const greeting = user?.name ? `Welcome back, ${user.name.split(" ")[0]}` : "Welcome back";

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <Link href="/" className="font-black text-black text-xl">Got Dirt?</Link>
        <div className="flex items-center gap-4 flex-wrap">
          <Link href="/dashboard/buyer/orders" className="text-sm text-gray-500 hover:text-gray-800">Orders</Link>
          <Link href="/dashboard/buyer/haul-orders" className="text-sm text-gray-500 hover:text-gray-800">Haul Orders</Link>
          <Link href="/dashboard/buyer/invoices" className="text-sm text-gray-500 hover:text-gray-800">Invoices</Link>
          <Link href="/dashboard/buyer/saved-pits" className="text-sm text-gray-500 hover:text-gray-800">Saved Pits</Link>
          {role === "CARRIER" && (
            <Link href="/dashboard/buyer/carrier-profile" className="text-sm text-gray-500 hover:text-gray-800">Carrier Profile</Link>
          )}
          {role !== "CARRIER" && (
            <Link href="/dashboard/buyer/settings" className="text-sm text-gray-500 hover:text-gray-800">Integrations</Link>
          )}
          <Link href="/dashboard/buyer/account" className="text-sm text-gray-500 hover:text-gray-800">Account</Link>
          <Link href="/map" className="bg-amber-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-amber-700">
            Find Pits →
          </Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">

        {/* Greeting */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{greeting}</h1>
          {user?.company && <p className="text-gray-500 mt-0.5">{user.company}</p>}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Projects",      value: projects.length,                  href: "/dashboard/buyer/projects/new" },
            { label: "Active Orders", value: activeOrders.length,              href: "/dashboard/buyer/orders" },
            { label: "Total Loads",   value: totalLoads,                       href: "/dashboard/buyer/orders" },
            { label: "Total Spent",   value: `$${(spentCents / 100).toFixed(2)}`, href: "/dashboard/buyer/invoices" },
          ].map((s) => (
            <Link key={s.label} href={s.href}
              className="bg-white rounded-2xl border border-gray-200 p-5 text-center hover:border-amber-400 transition-colors">
              <p className="text-2xl font-black text-gray-900">{s.value}</p>
              <p className="text-sm text-gray-500 mt-1">{s.label}</p>
            </Link>
          ))}
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Order History",   icon: "📋", href: "/dashboard/buyer/orders" },
            { label: "Invoices",        icon: "🧾", href: "/dashboard/buyer/invoices" },
            { label: "Saved Pits",      icon: "📌", href: "/dashboard/buyer/saved-pits" },
            { label: "My Account",      icon: "👤", href: "/dashboard/buyer/account" },
          ].map((item) => (
            <Link key={item.label} href={item.href}
              className="bg-white rounded-2xl border border-gray-200 p-4 flex flex-col items-center gap-2 hover:border-amber-400 transition-colors">
              <span className="text-2xl">{item.icon}</span>
              <span className="text-xs font-semibold text-gray-600 text-center">{item.label}</span>
            </Link>
          ))}
        </div>

        {/* Projects */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-900">My Projects</h2>
            <Link href="/dashboard/buyer/projects/new"
              className="bg-amber-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-amber-700">
              + New Project
            </Link>
          </div>
          {projects.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-gray-400">
              <p className="font-semibold text-gray-600 mb-1">No projects yet</p>
              <p className="text-sm mb-4">Create a project to start placing orders at dirt pits.</p>
              <Link href="/dashboard/buyer/projects/new" className="text-amber-600 font-medium hover:underline text-sm">
                Create your first project →
              </Link>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {projects.map((p) => (
                <Link key={p.id} href={`/dashboard/buyer/projects/${p.id}`}
                  className="bg-white rounded-2xl border border-gray-200 p-5 hover:border-amber-400 transition-colors">
                  <p className="font-bold text-gray-900">{p.name}</p>
                  {(p as { location?: string }).location && (
                    <p className="text-sm text-gray-500 mt-0.5">{(p as { location?: string }).location}</p>
                  )}
                  <p className="text-xs text-amber-600 mt-2 font-medium">
                    {p._count.orders} order{p._count.orders !== 1 ? "s" : ""}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Active Orders */}
        {activeOrders.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-gray-900">Active Orders</h2>
              <Link href="/dashboard/buyer/orders" className="text-sm text-amber-600 hover:underline">View all →</Link>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {["Project", "Pit", "Date", "Loads"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {activeOrders.map((o) => (
                    <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900">{o.project.name}</td>
                      <td className="px-4 py-3 text-gray-600">{o.pit.name}</td>
                      <td className="px-4 py-3 text-gray-500">{new Date(o.date).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">
                          {o._count.loadEvents}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Recent Activity */}
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-3">Recent Activity <span className="text-sm font-normal text-gray-400">(last 7 days)</span></h2>
          {recentActivity.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center text-gray-400 text-sm">
              No activity in the last 7 days.
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
              {recentActivity.map((event) => (
                <div key={event.id} className="flex items-center gap-4 px-5 py-3.5">
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                    <span className="text-sm">✅</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      Load verified at <span className="text-amber-700">{event.pit.name}</span>
                    </p>
                    <p className="text-xs text-gray-500">{event.order.project.name} · {event.materialType}</p>
                  </div>
                  <div className="ml-auto text-xs text-gray-400 shrink-0">
                    {event.exitTime
                      ? new Date(event.exitTime).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
                      : "—"}
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
