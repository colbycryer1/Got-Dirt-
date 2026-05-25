import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { centsToDisplay } from "@/types";
import LogoutButton from "@/components/LogoutButton";

export default async function AdminDashboard() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") redirect("/dashboard");

  const [pitCount, userCount, settlementStats, loadCount] = await Promise.all([
    prisma.pit.count({ where: { status: "ACTIVE" } }),
    prisma.user.count(),
    prisma.settlement.aggregate({
      where: { status: "PROCESSED" },
      _sum:   { grossAmountCents: true, commissionCents: true, netToPitCents: true, verifiedLoadCount: true },
      _count: { _all: true },
    }),
    prisma.loadEvent.count({ where: { verified: true, disputed: false } }),
  ]);

  const totalSettlements  = settlementStats._count._all;
  const grossRevenue      = settlementStats._sum.grossAmountCents  ?? 0;
  const platformRevenue   = settlementStats._sum.commissionCents   ?? 0;
  const totalLoadsCharged = settlementStats._sum.verifiedLoadCount ?? 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <span className="font-black text-black text-xl">Got Dirt?</span>
        <div className="flex items-center gap-4">
          <Link href="/map" className="text-sm text-gray-500 hover:text-gray-800">View Map</Link>
          <LogoutButton />
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">Admin Dashboard</h1>

        {/* KPIs */}
        <div className="grid sm:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Active Pits",       value: pitCount,                          color: "text-amber-700",  href: "/dashboard/admin/pits" },
            { label: "Users",             value: userCount,                          color: "text-blue-700",   href: "/dashboard/admin/users" },
            { label: "Total Loads Logged",value: loadCount,                          color: "text-purple-700", href: "/dashboard/admin/transactions" },
            { label: "Platform Revenue",  value: centsToDisplay(platformRevenue),    color: "text-green-700",  href: "/dashboard/admin/transactions" },
          ].map((kpi) => (
            <Link key={kpi.label} href={kpi.href} className="bg-white rounded-2xl border border-gray-200 p-5 hover:border-amber-400 transition-colors">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{kpi.label}</p>
              <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
            </Link>
          ))}
        </div>

        {/* Revenue summary row */}
        <div className="grid sm:grid-cols-3 gap-4 mb-10">
          <div className="bg-white rounded-2xl border border-gray-200 p-4 text-center">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Gross Processed</p>
            <p className="text-xl font-bold text-gray-900">{centsToDisplay(grossRevenue)}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-4 text-center">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Platform Revenue (8%)</p>
            <p className="text-xl font-bold text-green-700">{centsToDisplay(platformRevenue)}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-4 text-center">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Paid to Pit Owners</p>
            <p className="text-xl font-bold text-gray-900">{centsToDisplay(settlementStats._sum.netToPitCents ?? 0)}</p>
          </div>
        </div>

        {/* Quick actions */}
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { href: "/dashboard/admin/upload", icon: "📂", title: "Import KMZ", desc: "Bulk upload pits from Google Earth" },
            { href: "/dashboard/admin/pits/new", icon: "➕", title: "Add Pit", desc: "Manually add a single pit" },
            { href: "/dashboard/admin/pits", icon: "📋", title: "Manage Pits", desc: "View, edit, and toggle all pits" },
            { href: "/dashboard/admin/users", icon: "👥", title: "Users", desc: "View and manage user accounts" },
            { href: "/dashboard/admin/drivers", icon: "🪪", title: "Driver Verification", desc: "Review GDOT license and insurance docs" },
            { href: "/dashboard/admin/kyc", icon: "🔐", title: "KYC Status", desc: "Pit owner Stripe verification status" },
            { href: "/dashboard/admin/aml", icon: "🚨", title: "AML Flags", desc: "Anti-money laundering review queue" },
            { href: "/dashboard/admin/claims", icon: "🏷️", title: "Pit Claims", desc: "Owners claiming admin-uploaded pits" },
            { href: "/dashboard/admin/transactions", icon: "💳", title: "Transactions", desc: "All charges, loads, and platform revenue" },
            { href: "/dashboard/admin/settlements",  icon: "💰", title: "Settlements",  desc: "COB settlement log and revenue" },
            { href: "/dashboard/admin/disputes", icon: "🚩", title: "Disputes", desc: "Disputed loads pending review" },
            { href: "/dashboard/admin/net-terms", icon: "📄", title: "Net Terms", desc: "Assign payment terms and view invoices" },
            { href: "/dashboard/admin/net-terms/exposure", icon: "📊", title: "Exposure", desc: "Cash flow exposure and receivables" },
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
