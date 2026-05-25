import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Earnings — Got Dirt?" };

function fmt(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export default async function DriverEarningsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role !== "DRIVER" && session.user.role !== "ADMIN") redirect("/dashboard");

  const profile = await prisma.driverProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  const allOrders = profile
    ? await prisma.haulOrder.findMany({
        where:   { driverId: profile.id },
        include: {
          pit:     { select: { name: true, state: true } },
          project: { select: { name: true } },
          buyer:   { select: { name: true, company: true } },
        },
        orderBy: { scheduledDate: "desc" },
      })
    : [];

  const completed = allOrders.filter((o) => o.status === "COMPLETED");
  const pending   = allOrders.filter((o) => o.status === "CONFIRMED" || o.status === "ACTIVE");

  const totalEarnedCents  = completed.reduce((sum, o) => sum + o.haulRateCents * o.loads, 0);
  const pendingEarnedCents = pending.reduce((sum, o)  => sum + o.haulRateCents * o.loads, 0);
  const totalLoads         = completed.reduce((sum, o) => sum + o.loads, 0);

  // Group completed by month
  const byMonth: Record<string, { label: string; cents: number; loads: number }> = {};
  for (const o of completed) {
    const key = new Date(o.scheduledDate).toLocaleDateString("en-US", { year: "numeric", month: "long" });
    if (!byMonth[key]) byMonth[key] = { label: key, cents: 0, loads: 0 };
    byMonth[key].cents += o.haulRateCents * o.loads;
    byMonth[key].loads += o.loads;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard/driver" className="text-amber-600 hover:text-amber-700 text-sm font-medium">
          ← Dashboard
        </Link>
        <span className="text-gray-300">|</span>
        <Link href="/" className="font-black text-black text-lg">Got Dirt?</Link>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        <h1 className="text-2xl font-bold text-gray-900">Earnings</h1>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-5 text-center">
            <p className="text-2xl font-black text-gray-900">{fmt(totalEarnedCents)}</p>
            <p className="text-sm text-gray-500 mt-1">Total Earned</p>
          </div>
          <div className="bg-white rounded-2xl border border-amber-200 p-5 text-center">
            <p className="text-2xl font-black text-amber-600">{fmt(pendingEarnedCents)}</p>
            <p className="text-sm text-gray-500 mt-1">Upcoming</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-5 text-center">
            <p className="text-2xl font-black text-gray-900">{totalLoads}</p>
            <p className="text-sm text-gray-500 mt-1">Loads Hauled</p>
          </div>
        </div>

        {/* Banking CTA if not set up */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-blue-800">Set up direct deposit to get paid</p>
            <p className="text-sm text-blue-600 mt-0.5">Connect your bank account via Stripe to receive payouts.</p>
          </div>
          <Link
            href="/dashboard/driver/banking"
            className="shrink-0 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            Banking →
          </Link>
        </div>

        {/* Monthly breakdown */}
        {Object.keys(byMonth).length > 0 && (
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-3">Monthly Breakdown</h2>
            <div className="space-y-2">
              {Object.values(byMonth).map((m) => (
                <div key={m.label} className="bg-white rounded-xl border border-gray-200 px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-800">{m.label}</p>
                    <p className="text-xs text-gray-400">{m.loads} load{m.loads !== 1 ? "s" : ""}</p>
                  </div>
                  <p className="font-bold text-gray-900">{fmt(m.cents)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming jobs */}
        {pending.length > 0 && (
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-3">Upcoming Earnings</h2>
            <div className="space-y-3">
              {pending.map((o) => (
                <div key={o.id} className="bg-white rounded-2xl border border-amber-200 p-5 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900">{o.buyer.company ?? o.buyer.name ?? "Buyer"}</p>
                    {o.pit && <p className="text-sm text-gray-500">{o.pit.name} · {o.pit.state}</p>}
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(o.scheduledDate).toLocaleDateString("en-US", {
                        weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                      })}
                    </p>
                    <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-semibold ${
                      o.status === "ACTIVE" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"
                    }`}>
                      {o.status}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-amber-600">{fmt(o.haulRateCents * o.loads)}</p>
                    <p className="text-xs text-gray-400">{o.loads} load{o.loads !== 1 ? "s" : ""}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Completed haul history */}
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-3">Completed Hauls</h2>
          {completed.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-gray-400">
              <p>No completed haul orders yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {completed.map((o) => (
                <div key={o.id} className="bg-white rounded-2xl border border-gray-200 p-5 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900">{o.buyer.company ?? o.buyer.name ?? "Buyer"}</p>
                    {o.pit && <p className="text-sm text-gray-500">{o.pit.name} · {o.pit.state}</p>}
                    {o.project && <p className="text-xs text-gray-400">{o.project.name}</p>}
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(o.scheduledDate).toLocaleDateString("en-US", {
                        weekday: "short", month: "short", day: "numeric",
                      })}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-gray-900">{fmt(o.haulRateCents * o.loads)}</p>
                    <p className="text-xs text-gray-400">{o.loads} load{o.loads !== 1 ? "s" : ""} @ {fmt(o.haulRateCents)}</p>
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
