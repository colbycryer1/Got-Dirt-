import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { centsToDisplay } from "@/types";

export default async function BuyerDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const role = session.user.role;
  if (role !== "BUYER" && role !== "CONTRACTOR") redirect("/dashboard");

  const [projects, activeOrders] = await Promise.all([
    prisma.project.findMany({
      where:   { buyerUserId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
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
  ]);

  const totalLoads = activeOrders.reduce((s, o) => s + o._count.loadEvents, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <Link href="/" className="font-black text-black text-xl">Got Dirt?</Link>
        <Link href="/map" className="text-amber-600 text-sm font-medium">Find Pits →</Link>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Projects", value: projects.length },
            { label: "Active Orders", value: activeOrders.length },
            { label: "Total Loads", value: totalLoads },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl border border-gray-200 p-5 text-center">
              <p className="text-3xl font-black text-gray-900">{s.value}</p>
              <p className="text-sm text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Projects */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-900">My Projects</h2>
            <Link href="/dashboard/buyer/projects/new" className="bg-amber-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-amber-700">
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
                <Link
                  key={p.id}
                  href={`/dashboard/buyer/projects/${p.id}`}
                  className="bg-white rounded-2xl border border-gray-200 p-5 hover:border-amber-400 transition-colors"
                >
                  <p className="font-bold text-gray-900">{p.name}</p>
                  {p.location && <p className="text-sm text-gray-500 mt-0.5">{p.location}</p>}
                  <p className="text-xs text-amber-600 mt-2 font-medium">{p._count.orders} order{p._count.orders !== 1 ? "s" : ""}</p>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Active orders */}
        {activeOrders.length > 0 && (
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-3">Active Orders</h2>
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
      </div>
    </div>
  );
}
