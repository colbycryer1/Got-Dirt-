import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import LocationToggle from "./LocationToggle";
import GpsLoadLogButton from "./GpsLoadLogButton";
import AvailableJobsFeed from "./AvailableJobsFeed";
import HaulOrderAlertModal from "./HaulOrderAlertModal";
import LogoutButton from "@/components/LogoutButton";
import { getHaulOrderLoadLogCounts } from "@/lib/haul-load-log";

export const metadata = { title: "Driver Dashboard — Got Dirt?" };

export default async function DriverDashboard() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role !== "DRIVER" && session.user.role !== "ADMIN") redirect("/dashboard");

  const [user, profile, haulOrders] = await Promise.all([
    prisma.user.findUnique({
      where:  { id: session.user.id },
      select: { name: true, email: true },
    }),
    prisma.driverProfile.findUnique({ where: { userId: session.user.id } }),
    prisma.haulOrder.findMany({
      where:   { driver: { userId: session.user.id } },
      include: {
        buyer:   { select: { name: true, company: true, phone: true } },
        pit:     { select: { name: true, state: true } },
        project: { select: { name: true } },
      },
      orderBy: { scheduledDate: "asc" },
      take: 20,
    }),
  ]);

  const greeting = user?.name ? `Welcome, ${user.name.split(" ")[0]}` : "Welcome";

  const profileComplete = !!(
    profile?.truckType &&
    profile?.haulRateCents &&
    profile?.gdotLicenseUrl &&
    profile?.insuranceUrl
  );

  const pendingOrders   = haulOrders.filter((o) => o.status === "PENDING");
  const confirmedOrders = haulOrders.filter((o) => o.status === "CONFIRMED");
  const activeOrders    = haulOrders.filter((o) => o.status === "ACTIVE");

  // Active/confirmed orders that have a pit — used for live load counts and GPS log button
  const ordersWithPit = haulOrders.filter(
    (o) => o.pitId && (o.status === "CONFIRMED" || o.status === "ACTIVE")
  );

  // Live pit operator Load Log counts (server-rendered, updates on each page load)
  const pitLogCounts = await getHaulOrderLoadLogCounts(
    ordersWithPit.map((o) => ({
      id:            o.id,
      pitId:         o.pitId,
      buyerUserId:   o.buyerUserId,
      scheduledDate: o.scheduledDate,
    }))
  );

  // Sum of all pit operator counts across confirmed/active orders today
  const totalPitLogCount = Object.values(pitLogCounts).reduce((s, n) => s + n, 0);

  // Driver's own load log counts
  const driverLogCounts = ordersWithPit.length > 0
    ? await prisma.driverLoadLog.groupBy({
        by:    ["haulOrderId"],
        where: { haulOrderId: { in: ordersWithPit.map((o) => o.id) }, driverUserId: session.user.id },
        _count: { id: true },
      })
    : [];
  const totalDriverLogCount = driverLogCounts.reduce((s, r) => s + r._count.id, 0);

  // Shape for GpsLoadLogButton
  const activeOrdersForButton = ordersWithPit.map((o) => ({
    id:       o.id,
    pitName:  o.pit?.name ?? "Pit",
    pitState: o.pit?.state ?? "",
    loads:    o.loads,
  }));

  return (
    <div className="min-h-screen bg-gray-50">
      <HaulOrderAlertModal />
      <nav className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <Link href="/" className="font-black text-black text-xl">Got Dirt?</Link>
        <div className="flex items-center gap-4 flex-wrap">
          <Link href="/dashboard/driver/profile"     className="text-sm text-gray-500 hover:text-gray-800">My Profile</Link>
          <Link href="/dashboard/driver/haul-orders" className="text-sm text-gray-500 hover:text-gray-800">Haul Orders</Link>
          <Link href="/dashboard/driver/loads"       className="text-sm text-gray-500 hover:text-gray-800">My Loads</Link>
          <Link href="/dashboard/driver/earnings"    className="text-sm text-gray-500 hover:text-gray-800">Earnings</Link>
          <Link href="/dashboard/driver/banking"     className="text-sm text-gray-500 hover:text-gray-800">Banking</Link>
          <LogoutButton />
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">

        <div>
          <h1 className="text-2xl font-bold text-gray-900">{greeting}</h1>
          <p className="text-gray-500 mt-0.5">Independent Truck Driver</p>
        </div>

        {/* Profile incomplete banner */}
        {!profileComplete && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-start gap-4">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="font-semibold text-amber-800">Complete your profile to receive haul orders</p>
              <p className="text-sm text-amber-700 mt-0.5">Add your truck type, haul rate, GDOT license, and insurance to appear on the buyer map.</p>
              <Link href="/dashboard/driver/profile"
                className="inline-block mt-3 bg-amber-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-amber-700">
                Set Up Profile →
              </Link>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Pending",   value: pendingOrders.length },
            { label: "Confirmed", value: confirmedOrders.length },
            { label: "Active",    value: activeOrders.length },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl border border-gray-200 p-5 text-center">
              <p className="text-2xl font-black text-gray-900">{s.value}</p>
              <p className="text-sm text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Live Load Counts — shown only when there are active/confirmed orders with a pit */}
        {ordersWithPit.length > 0 && (
          <div className="grid grid-cols-2 gap-4">
            {/* Pit operator's count */}
            <div className="bg-white rounded-2xl border border-blue-200 p-5 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Pit Log (Live)</p>
              </div>
              <p className="text-4xl font-black text-gray-900">{totalPitLogCount}</p>
              <p className="text-sm text-gray-500 mt-1">Loads at Pit</p>
              <p className="text-xs text-gray-400 mt-0.5">Logged by pit operator</p>
            </div>

            {/* Driver's own GPS log count */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 text-center">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Your Log</p>
              <p className="text-4xl font-black text-gray-900">{totalDriverLogCount}</p>
              <p className="text-sm text-gray-500 mt-1">Loads Logged</p>
              <p className="text-xs text-gray-400 mt-0.5">From GPS tap below</p>
            </div>
          </div>
        )}

        {/* Live location toggle */}
        <LocationToggle
          enabled={profile?.liveLocationEnabled ?? false}
          lat={profile?.currentLat ?? null}
          lng={profile?.currentLng ?? null}
        />

        {/* GPS-gated load log button */}
        <GpsLoadLogButton
          locationEnabled={profile?.liveLocationEnabled ?? false}
          activeOrders={activeOrdersForButton}
        />

        {/* Pending requests — action required */}
        {pendingOrders.length > 0 && (
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-3">
              Pending Requests
              <span className="ml-2 bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">{pendingOrders.length}</span>
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
                        {new Date(o.scheduledDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
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
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-gray-100 flex gap-3">
                    <RespondButton orderId={o.id} action="CONFIRM" />
                    <RespondButton orderId={o.id} action="DENY" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming confirmed */}
        {confirmedOrders.length > 0 && (
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-3">Upcoming</h2>
            <div className="space-y-3">
              {confirmedOrders.map((o) => {
                const pitCount = pitLogCounts[o.id];
                return (
                  <div key={o.id} className="bg-white rounded-2xl border border-gray-200 p-5 space-y-2">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-gray-900">{o.buyer.company ?? o.buyer.name ?? "Buyer"}</p>
                          <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">CONFIRMED</span>
                        </div>
                        {o.pit && <p className="text-sm text-gray-500">{o.pit.name} · {o.pit.state}</p>}
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(o.scheduledDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        {pitCount !== undefined ? (
                          <>
                            <p className="font-bold text-gray-900">{pitCount} load{pitCount !== 1 ? "s" : ""}</p>
                            <p className="text-xs text-blue-600 font-semibold">Live · Pit Log</p>
                          </>
                        ) : (
                          <p className="font-bold text-gray-900">{o.loads} load{o.loads !== 1 ? "s" : ""} (est.)</p>
                        )}
                        <p className="text-sm text-gray-500">${(o.haulRateCents / 100).toFixed(2)}/load</p>
                      </div>
                    </div>
                    {pitCount !== undefined && o.pit && (
                      <div className={`rounded-lg px-3 py-2 text-xs flex items-center gap-2 ${pitCount > 0 ? "bg-blue-50 text-blue-700" : "bg-gray-50 text-gray-500"}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${pitCount > 0 ? "bg-blue-500 animate-pulse" : "bg-gray-300"}`} />
                        {pitCount > 0 ? `${pitCount} logged at ${o.pit.name}` : `Waiting for pit operator at ${o.pit.name}`}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {pendingOrders.length === 0 && confirmedOrders.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-gray-400">
            <p className="font-semibold text-gray-600 mb-1">No active haul orders</p>
            <p className="text-sm">Complete your profile so buyers can find and book you.</p>
          </div>
        )}

        {/* Open broadcast jobs */}
        {profileComplete && (
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-3">Available Jobs</h2>
            <p className="text-xs text-gray-400 mb-3">Open broadcast haul jobs — first to claim gets it.</p>
            <AvailableJobsFeed />
          </div>
        )}

        {/* Quick links */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: "My Profile",  icon: "🪪", href: "/dashboard/driver/profile" },
            { label: "Haul Orders", icon: "📋", href: "/dashboard/driver/haul-orders" },
            { label: "My Loads",    icon: "🚛", href: "/dashboard/driver/loads" },
            { label: "Earnings",    icon: "💰", href: "/dashboard/driver/earnings" },
            { label: "Banking",     icon: "🏦", href: "/dashboard/driver/banking" },
            { label: "My Account",  icon: "👤", href: "/dashboard/buyer/account" },
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

function RespondButton({ orderId, action }: { orderId: string; action: "CONFIRM" | "DENY" }) {
  return (
    <form action={`/api/haul-orders/${orderId}/respond`} method="POST" className="flex-1">
      <input type="hidden" name="action" value={action} />
      <Link
        href={`/dashboard/driver/haul-orders?respond=${orderId}&action=${action}`}
        className={`block w-full text-center py-2 rounded-xl text-sm font-semibold transition-colors
          ${action === "CONFIRM"
            ? "bg-green-600 text-white hover:bg-green-700"
            : "bg-white border border-gray-300 text-gray-600 hover:bg-gray-50"}`}
      >
        {action === "CONFIRM" ? "Confirm" : "Deny"}
      </Link>
    </form>
  );
}
