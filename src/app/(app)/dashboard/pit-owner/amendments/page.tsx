import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import PitOwnerAmendmentRespondForm from "./PitOwnerAmendmentRespondForm";

export const metadata = { title: "Haul Order Amendments — Got Dirt?" };

export default async function PitOwnerAmendmentsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role !== "PIT_OWNER" && session.user.role !== "ADMIN") redirect("/dashboard");

  // Get all pits owned by this user
  const pits = await prisma.pit.findMany({
    where:  { ownerId: session.user.id },
    select: { id: true, name: true },
  });
  const pitIds = pits.map((p) => p.id);

  // Find all pending amendments for haul orders on this pit owner's pits
  const amendments = pitIds.length > 0
    ? await prisma.haulOrderAmendment.findMany({
        where: {
          status:          "PENDING",
          pitOwnerApproved: null,
          haulOrder: {
            pitId: { in: pitIds },
          },
        },
        include: {
          haulOrder: {
            include: {
              buyer:   { select: { name: true, company: true } },
              pit:     { select: { name: true, state: true } },
              project: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      })
    : [];

  const fmt = (cents: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard/pit-owner" className="text-amber-600 hover:text-amber-700 text-sm font-medium">← Dashboard</Link>
        <span className="text-gray-300">|</span>
        <Link href="/" className="font-black text-black text-lg">Got Dirt?</Link>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Haul Order Amendments</h1>
          {amendments.length > 0 && (
            <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2.5 py-1 rounded-full">
              {amendments.length} pending
            </span>
          )}
        </div>

        {amendments.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <p className="text-gray-500 font-medium mb-1">No pending amendments</p>
            <p className="text-sm text-gray-400">
              When buyers request extra loads on haul orders at your pits, they will appear here for your approval.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {amendments.map((amendment) => {
              const order = amendment.haulOrder;
              const buyerName = order.buyer.company ?? order.buyer.name ?? "Buyer";
              const extraLoads = amendment.requestedLoads - amendment.originalLoads;
              const extraChargeCents = extraLoads * order.haulRateCents;

              return (
                <div key={amendment.id} className="bg-white rounded-2xl border border-amber-200 p-5 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-block w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                        <p className="font-bold text-gray-900">{buyerName}</p>
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">
                          Amendment Request
                        </span>
                      </div>
                      {order.pit && (
                        <p className="text-sm text-gray-500 mt-0.5">{order.pit.name} · {order.pit.state}</p>
                      )}
                      {order.project && (
                        <p className="text-xs text-gray-400">{order.project.name}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        Scheduled: {new Date(order.scheduledDate).toLocaleDateString("en-US", {
                          weekday: "short", month: "short", day: "numeric",
                        })}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-gray-900">
                        {amendment.originalLoads} → {amendment.requestedLoads} loads
                      </p>
                      <p className="text-xs text-amber-600 font-semibold">
                        +{extraLoads} extra ({fmt(extraChargeCents)})
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        @ {fmt(order.haulRateCents)}/load
                      </p>
                    </div>
                  </div>

                  {amendment.reason && (
                    <div className="bg-gray-50 rounded-xl px-4 py-2.5 text-sm text-gray-600">
                      <span className="font-semibold text-gray-500 text-xs">Buyer note: </span>
                      {amendment.reason}
                    </div>
                  )}

                  <div className="pt-1">
                    <p className="text-xs text-gray-500 mb-2">
                      Hauler status:{" "}
                      {amendment.haulerApproved === null
                        ? "Awaiting response"
                        : amendment.haulerApproved
                        ? "✓ Approved"
                        : "✗ Denied"}
                    </p>
                    <PitOwnerAmendmentRespondForm
                      orderId={order.id}
                      amendmentId={amendment.id}
                    />
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
