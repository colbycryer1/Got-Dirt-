import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { centsToDisplay } from "@/types";

export default async function AdminDashboard() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") redirect("/dashboard");

  const [pitCount, userCount, totalTransactions, platformRevenue] = await Promise.all([
    prisma.pit.count({ where: { status: "ACTIVE" } }),
    prisma.user.count(),
    prisma.transaction.count({ where: { status: "SUCCEEDED" } }),
    prisma.transaction.aggregate({
      where: { status: "SUCCEEDED" },
      _sum: { platformFeeCents: true },
    }),
  ]);

  const revenueTotal = platformRevenue._sum.platformFeeCents ?? 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <span className="font-black text-black text-xl">Got Dirt? Admin</span>
        <Link href="/map" className="text-sm text-gray-500 hover:text-gray-800">View Map</Link>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">Admin Dashboard</h1>

        {/* KPIs */}
        <div className="grid sm:grid-cols-4 gap-4 mb-10">
          {[
            { label: "Active Pits", value: pitCount, color: "text-amber-700" },
            { label: "Users", value: userCount, color: "text-blue-700" },
            { label: "Transactions", value: totalTransactions, color: "text-purple-700" },
            { label: "Platform Revenue", value: centsToDisplay(revenueTotal), color: "text-orange-700" },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-white rounded-2xl border border-gray-200 p-5">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{kpi.label}</p>
              <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { href: "/dashboard/admin/upload", icon: "📂", title: "Import KMZ", desc: "Bulk upload pits from Google Earth" },
            { href: "/dashboard/admin/pits/new", icon: "➕", title: "Add Pit", desc: "Manually add a single pit" },
            { href: "/dashboard/admin/pits", icon: "📋", title: "Manage Pits", desc: "View, edit, and toggle all pits" },
            { href: "/dashboard/admin/users", icon: "👥", title: "Users", desc: "View and manage user accounts" },
            { href: "/dashboard/admin/settlements", icon: "💰", title: "Settlements", desc: "COB settlement log and revenue" },
            { href: "/dashboard/admin/disputes", icon: "🚩", title: "Disputes", desc: "Disputed loads pending review" },
            { href: "/dashboard/admin/settings", icon: "⚙️", title: "Settings", desc: "Platform fee and configuration" },
            { href: "/map", icon: "🗺️", title: "View Map", desc: "See pits as users see them" },
          ].map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="bg-white rounded-2xl border border-gray-200 p-5 hover:border-amber-400 hover:shadow-sm transition-all group"
            >
              <div className="text-3xl mb-3">{action.icon}</div>
              <h3 className="font-semibold text-gray-900 group-hover:text-amber-700">{action.title}</h3>
              <p className="text-sm text-gray-500 mt-1">{action.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
