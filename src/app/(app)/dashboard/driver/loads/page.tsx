import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "My Loads — Got Dirt?" };

export default async function DriverLoadsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role !== "DRIVER" && session.user.role !== "ADMIN") redirect("/dashboard");

  const events = await prisma.loadEvent.findMany({
    where:   { driverUserId: session.user.id },
    include: {
      pit:   { select: { name: true, state: true } },
      order: { select: { id: true, date: true, project: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  // Summaries
  const totalLoads   = events.length;
  const verifiedLoads = events.filter((e) => e.verified).length;
  const totalEarned  = events
    .filter((e) => e.verified)
    .reduce((sum, e) => sum + e.rateCentsAtTime, 0);

  // Group by material
  const byMaterial: Record<string, number> = {};
  for (const e of events) {
    byMaterial[e.materialType] = (byMaterial[e.materialType] ?? 0) + 1;
  }

  // Group by date
  const byDate: Record<string, typeof events> = {};
  for (const e of events) {
    const key = new Date(e.createdAt).toLocaleDateString("en-US", {
      weekday: "short", month: "short", day: "numeric", year: "numeric",
    });
    if (!byDate[key]) byDate[key] = [];
    byDate[key].push(e);
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
        <h1 className="text-2xl font-bold text-gray-900">My Loads</h1>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-5 text-center">
            <p className="text-2xl font-black text-gray-900">{totalLoads}</p>
            <p className="text-sm text-gray-500 mt-1">Total Loads</p>
          </div>
          <div className="bg-white rounded-2xl border border-green-200 p-5 text-center">
            <p className="text-2xl font-black text-green-700">{verifiedLoads}</p>
            <p className="text-sm text-gray-500 mt-1">Verified</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-5 text-center">
            <p className="text-2xl font-black text-gray-900">
              {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(totalEarned / 100)}
            </p>
            <p className="text-sm text-gray-500 mt-1">Earned</p>
          </div>
        </div>

        {/* Material breakdown */}
        {Object.keys(byMaterial).length > 0 && (
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-3">By Material</h2>
            <div className="flex flex-wrap gap-2">
              {Object.entries(byMaterial)
                .sort((a, b) => b[1] - a[1])
                .map(([mat, count]) => (
                  <span
                    key={mat}
                    className="bg-white border border-gray-200 rounded-full px-4 py-1.5 text-sm font-medium text-gray-700"
                  >
                    {mat} <span className="text-gray-400">×{count}</span>
                  </span>
                ))}
            </div>
          </div>
        )}

        {/* Load history grouped by date */}
        {events.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-400">
            <p className="font-semibold text-gray-600 mb-1">No loads logged yet</p>
            <p className="text-sm">Loads you haul will appear here once verified.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(byDate).map(([date, dayEvents]) => (
              <div key={date}>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">{date}</p>
                <div className="space-y-2">
                  {dayEvents.map((e) => (
                    <div
                      key={e.id}
                      className="bg-white rounded-xl border border-gray-200 px-5 py-3 flex items-center justify-between gap-4"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-gray-800">{e.materialType}</p>
                          {e.verified ? (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">
                              Verified
                            </span>
                          ) : (
                            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-semibold">
                              Pending
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">{e.pit.name} · {e.pit.state}</p>
                        {e.order.project?.name && (
                          <p className="text-xs text-gray-400">{e.order.project.name}</p>
                        )}
                        <p className="text-xs text-gray-400">
                          {new Date(e.createdAt).toLocaleTimeString("en-US", {
                            hour: "numeric", minute: "2-digit",
                          })}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-semibold text-gray-900">
                          {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })
                            .format(e.rateCentsAtTime / 100)}
                        </p>
                        <p className="text-xs text-gray-400 capitalize">{e.verificationMethod.toLowerCase()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
