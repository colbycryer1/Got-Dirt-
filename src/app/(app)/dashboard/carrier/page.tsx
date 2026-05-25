import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import HaulOrderAlertModal from "@/app/(app)/dashboard/driver/HaulOrderAlertModal";
import LogoutButton from "@/components/LogoutButton";

export const metadata = { title: "Carrier Dashboard — Got Dirt?" };

export default async function CarrierDashboard() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role !== "CARRIER" && session.user.role !== "ADMIN") redirect("/dashboard");

  const [user, profile, haulOrders] = await Promise.all([
    prisma.user.findUnique({
      where:  { id: session.user.id },
      select: { name: true, company: true, email: true },
    }),
    prisma.carrierProfile.findUnique({
      where:   { userId: session.user.id },
      include: { terminals: { select: { id: true, name: true, address: true } } },
    }),
    prisma.haulOrder.findMany({
      where:   { carrier: { userId: session.user.id } },
      include: {
        buyer:   { select: { name: true, company: true, phone: true } },
        pit:     { select: { name: true, state: true } },
        project: { select: { name: true } },
      },
      orderBy: { scheduledDate: "asc" },
      take: 20,
    }),
  ]);

  const displayName = user?.company ?? user?.name ?? "Carrier";
  const greeting    = `Welcome, ${displayName.split(" ")[0]}`;

  const pendingOrders   = haulOrders.filter((o) => o.status === "PENDING");
  const confirmedOrders = haulOrders.filter((o) => o.status === "CONFIRMED");
  const activeOrders    = haulOrders.filter((o) => o.status === "ACTIVE");
  const completedCount  = haulOrders.filter((o) => o.status === "COMPLETED").length;

  return (
    <div className="min-h-screen bg-gray-50">
      <HaulOrderAlertModal />
      <nav className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <Link href="/" className="font-black text-black text-xl">Got Dirt?</Link>
        <div className="flex items-center gap-4 flex-wrap">
          <Link href="/dashboard/carrier/haul-orders" className="text-sm text-gray-500 hover:text-gray-800">Haul Orders</Link>
          <Link href="/dashboard/carrier/profile"     className="text-sm text-gray-500 hover:text-gray-800">Profile</Link>
          <Link href="/dashboard/carrier/banking"     className="text-sm text-gray-500 hover:text-gray-800">Banking</Link>
          <LogoutButton />
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">

        <div>
          <h1 className="text-2xl font-bold text-gray-900">{greeting}</h1>
          <p className="text-gray-500 mt-0.5">3PL / Carrier</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Pending",   value: pendingOrders.length,   color: "text-amber-700" },
            { label: "Confirmed", value: confirmedOrders.length,  color: "text-green-700" },
            { label: "Active",    value: activeOrders.length,     color: "text-blue-700" },
            { label: "Completed", value: completedCount,          color: "text-gray-900" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl border border-gray-200 p-5 text-center">
              <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
              <p className="text-sm text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Pending requests */}
        {pendingOrders.length > 0 && (
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-3">
              Pending Requests
              <span className="ml-2 bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">
                {pendingOrders.length}
              </span>
            </h2>
            <div className="space-y-3">
              {pendingOrders.map((o) => (
                <div key={o.id} className="bg-white rounded-2xl border border-amber-300 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900">{o.buyer.company ?? o.buyer.name ?? "Buyer"}</p>
                      {o.pit && <p className="text-sm text-gray-500">{o.pit.name} · {o.pit.state}</p>}
                      {o.project && <p className="text-xs text-gray-400">{o.project.name}</p>}
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(o.scheduledDate).toLocaleDateString("en-US", {
                          weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                        })}
                      </p>
                      {o.expiresAt && (
                        <p className="text-xs text-red-500 mt-0.5">
                          Expires {new Date(o.expiresAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-gray-900">{o.loads} load{o.loads !== 1 ? "s" : ""}</p>
                      <p className="text-sm text-gray-500">${(o.haulRateCents / 100).toFixed(2)}/load</p>
                      <p className="text-xs font-semibold text-amber-700 mt-0.5">
                        ~${((o.haulRateCents * o.loads) / 100).toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-gray-100 flex gap-3">
                    <Link
                      href={`/dashboard/carrier/haul-orders?respond=${o.id}&action=CONFIRM`}
                      className="flex-1 text-center bg-green-600 text-white py-2 rounded-xl text-sm font-semibold hover:bg-green-700"
                    >
                      Confirm
                    </Link>
                    <Link
                      href={`/dashboard/carrier/haul-orders?respond=${o.id}&action=DENY`}
                      className="flex-1 text-center bg-white border border-gray-300 text-gray-600 py-2 rounded-xl text-sm font-semibold hover:bg-gray-50"
                    >
                      Deny
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Confirmed upcoming */}
        {confirmedOrders.length > 0 && (
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-3">Upcoming</h2>
            <div className="space-y-3">
              {confirmedOrders.map((o) => (
                <div key={o.id} className="bg-white rounded-2xl border border-gray-200 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-gray-900">{o.buyer.company ?? o.buyer.name ?? "Buyer"}</p>
                        <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">CONFIRMED</span>
                      </div>
                      {o.pit && <p className="text-sm text-gray-500">{o.pit.name} · {o.pit.state}</p>}
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(o.scheduledDate).toLocaleDateString("en-US", {
                          weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                        })}
                      </p>
                      {o.buyer.phone && <p className="text-xs text-gray-500 mt-0.5">📞 {o.buyer.phone}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-gray-900">{o.loads} load{o.loads !== 1 ? "s" : ""}</p>
                      <p className="text-sm text-gray-500">${(o.haulRateCents / 100).toFixed(2)}/load</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {pendingOrders.length === 0 && confirmedOrders.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-gray-400">
            <p className="font-semibold text-gray-600 mb-1">No active haul orders</p>
            <p className="text-sm">Broadcast jobs and direct requests will appear here.</p>
          </div>
        )}

        {/* Terminals */}
        {profile?.terminals && profile.terminals.length > 0 && (
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-3">Terminals</h2>
            <div className="space-y-2">
              {profile.terminals.map((t) => (
                <div key={t.id} className="bg-white rounded-xl border border-gray-200 px-5 py-3">
                  <p className="font-medium text-gray-800">{t.name}</p>
                  {t.address && <p className="text-sm text-gray-500">{t.address}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick links */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: "Haul Orders", icon: "📋", href: "/dashboard/carrier/haul-orders" },
            { label: "Profile",     icon: "🏢", href: "/dashboard/carrier/profile" },
            { label: "Banking",     icon: "🏦", href: "/dashboard/carrier/banking" },
          ].map((item) => (
            <Link key={item.label} href={item.href}
              className="bg-white rounded-2xl border border-gray-200 p-4 flex flex-col items-center gap-2 hover:border-amber-400 transition-colors">
              <span className="text-2xl">{item.icon}</span>
              <span className="text-xs font-semibold text-gray-600 text-center">{item.label}</span>
            </Link>
          ))}
        </div>

      </div>
    </div>
  );
}
