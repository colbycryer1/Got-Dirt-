import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const metadata = { title: "My Projects — Got Dirt?" };

export default async function ProjectsListPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const isBuyer = session.user.role === "BUYER" || session.user.role === "CARRIER" || session.user.role === "CONTRACTOR";
  if (!isBuyer && session.user.role !== "ADMIN") redirect("/dashboard");

  const projects = await prisma.project.findMany({
    where:   { buyerUserId: session.user.id },
    include: {
      _count: { select: { orders: true } },
      orders: {
        select: {
          status: true,
          _count: { select: { loadEvents: true } },
          settlements: { select: { grossAmountCents: true, status: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

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
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">My Projects</h1>
          <Link
            href="/dashboard/buyer/projects/new"
            className="bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-amber-700 transition-colors"
          >
            + New Project
          </Link>
        </div>

        {projects.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <p className="text-4xl mb-4">📁</p>
            <p className="font-semibold text-gray-700 mb-2">No projects yet</p>
            <p className="text-sm text-gray-400 mb-6">Create a project to track loads, invoices, and spending by job site.</p>
            <Link
              href="/dashboard/buyer/projects/new"
              className="bg-amber-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-amber-700 transition-colors"
            >
              Create First Project
            </Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {projects.map((p) => {
              const totalLoads = p.orders.reduce((s, o) => s + o._count.loadEvents, 0);
              const totalSpent = p.orders.flatMap((o) => o.settlements)
                .filter((s) => s.status === "PROCESSED")
                .reduce((s, st) => s + st.grossAmountCents, 0);
              const activeOrders = p.orders.filter((o) => o.status === "ACTIVE").length;

              return (
                <Link
                  key={p.id}
                  href={`/dashboard/buyer/projects/${p.id}`}
                  className="bg-white rounded-2xl border border-gray-200 p-6 hover:border-amber-400 transition-colors group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900 group-hover:text-amber-700 transition-colors">{p.name}</p>
                      {p.location && <p className="text-sm text-gray-500 mt-0.5">{p.location}</p>}
                      {p.description && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{p.description}</p>}
                    </div>
                    {activeOrders > 0 && (
                      <span className="ml-3 shrink-0 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">
                        {activeOrders} active
                      </span>
                    )}
                  </div>

                  <div className="flex gap-4 text-sm text-gray-500 mt-4 pt-4 border-t border-gray-100">
                    <span><span className="font-semibold text-gray-800">{p._count.orders}</span> order{p._count.orders !== 1 ? "s" : ""}</span>
                    <span><span className="font-semibold text-gray-800">{totalLoads}</span> load{totalLoads !== 1 ? "s" : ""}</span>
                    {totalSpent > 0 && (
                      <span className="ml-auto font-semibold text-gray-800">${(totalSpent / 100).toFixed(2)}</span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
