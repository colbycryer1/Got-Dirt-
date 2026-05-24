import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function NetTermsExposurePage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");

  let data: Awaited<ReturnType<typeof fetchExposure>> | null = null;
  let migrationPending = false;

  try {
    data = await fetchExposure();
  } catch {
    migrationPending = true;
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cash Flow Exposure</h1>
          <p className="text-sm text-gray-500 mt-1">
            Net terms receivables — Got Dirt LLC has fronted these pit payouts pending buyer invoice payment
          </p>
        </div>
        <Link href="/dashboard/admin/net-terms" className="text-sm text-amber-600 hover:underline">
          ← Net Terms
        </Link>
      </div>

      {migrationPending && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-800 text-sm">
          <strong>Migration required:</strong> Run{" "}
          <code className="bg-amber-100 px-1 rounded">phase2_net_terms_integrations.sql</code> in Supabase SQL Editor.
        </div>
      )}

      {!migrationPending && data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <ExposureCard label="Total Exposure" value={`$${(data.totalExposureCents / 100).toLocaleString()}`} note="all open/overdue" />
            <ExposureCard label="Overdue Exposure" value={`$${(data.overdueExposureCents / 100).toLocaleString()}`} note="past due date" highlight />
            <ExposureCard label="Pit Advances" value={`$${(data.pitAdvanceCents / 100).toLocaleString()}`} note="fronted this month" />
            <ExposureCard label="Accounts" value={String(data.accountCount)} note="on net terms" />
          </div>

          {data.byBuyer.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 font-semibold text-gray-700 text-sm">
                Exposure by Buyer
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {["Buyer", "Terms", "Credit Limit", "Open Balance", "Overdue", "Utilization"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left font-medium text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.byBuyer.map((row) => {
                    const utilPct = row.creditLimitCents
                      ? Math.round((row.openBalanceCents / row.creditLimitCents) * 100)
                      : null;
                    return (
                      <tr key={row.buyerUserId} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <Link
                            href={`/dashboard/admin/net-terms/${row.buyerUserId}`}
                            className="font-medium text-gray-900 hover:text-amber-600"
                          >
                            {row.buyerName}
                          </Link>
                          <div className="text-xs text-gray-400">{row.buyerEmail}</div>
                        </td>
                        <td className="px-4 py-3 text-gray-700">NET {row.termsDays}</td>
                        <td className="px-4 py-3 text-gray-700">
                          {row.creditLimitCents
                            ? `$${(row.creditLimitCents / 100).toLocaleString()}`
                            : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-900">
                          ${(row.openBalanceCents / 100).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          {row.overdueBalanceCents > 0 ? (
                            <span className="text-red-600 font-medium">
                              ${(row.overdueBalanceCents / 100).toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {utilPct !== null ? (
                            <div className="flex items-center gap-2">
                              <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${utilPct >= 90 ? "bg-red-500" : utilPct >= 70 ? "bg-amber-500" : "bg-green-500"}`}
                                  style={{ width: `${Math.min(100, utilPct)}%` }}
                                />
                              </div>
                              <span className={`text-xs font-medium ${utilPct >= 90 ? "text-red-600" : "text-gray-600"}`}>
                                {utilPct}%
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs">No limit</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ExposureCard({
  label, value, note, highlight,
}: {
  label: string; value: string; note: string; highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-4 ${highlight ? "bg-red-50 border-red-200" : "bg-white border-gray-200"}`}>
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${highlight ? "text-red-700" : "text-gray-900"}`}>{value}</div>
      <div className="text-xs text-gray-400 mt-0.5">{note}</div>
    </div>
  );
}

async function fetchExposure() {
  const accounts = await prisma.netTermsAccount.findMany({
    include: {
      buyer: { select: { id: true, email: true, name: true, company: true } },
      netTermsInvoices: {
        where: { status: { in: ["OPEN", "OVERDUE"] } },
        select: { id: true, totalDueCents: true, status: true },
      },
    },
  });

  // Pit advances fronted this month
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const pitAdvances = await prisma.settlement.aggregate({
    where: { pitAdvanceByGotdirt: true, createdAt: { gte: monthStart } },
    _sum: { grossAmountCents: true },
  });

  const byBuyer = accounts.map((acc) => {
    const openBalanceCents = acc.netTermsInvoices.reduce((s, i) => s + i.totalDueCents, 0);
    const overdueBalanceCents = acc.netTermsInvoices
      .filter((i) => i.status === "OVERDUE")
      .reduce((s, i) => s + i.totalDueCents, 0);

    return {
      buyerUserId: acc.buyerUserId,
      buyerName: acc.buyer.company ?? acc.buyer.name ?? acc.buyer.email,
      buyerEmail: acc.buyer.email,
      termsDays: acc.termsDays,
      creditLimitCents: acc.creditLimitCents,
      openBalanceCents,
      overdueBalanceCents,
    };
  });

  const totalExposureCents = byBuyer.reduce((s, r) => s + r.openBalanceCents, 0);
  const overdueExposureCents = byBuyer.reduce((s, r) => s + r.overdueBalanceCents, 0);

  return {
    totalExposureCents,
    overdueExposureCents,
    pitAdvanceCents: pitAdvances._sum.grossAmountCents ?? 0,
    accountCount: accounts.length,
    byBuyer: byBuyer.sort((a, b) => b.openBalanceCents - a.openBalanceCents),
  };
}
