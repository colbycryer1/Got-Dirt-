import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function NetTermsInvoicesPage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");

  let invoices: Awaited<ReturnType<typeof fetchInvoices>> = [];
  let migrationPending = false;

  try {
    invoices = await fetchInvoices();
  } catch {
    migrationPending = true;
  }

  const overdue = invoices.filter((i) => i.status === "OVERDUE");
  const open    = invoices.filter((i) => i.status === "OPEN");
  const paid    = invoices.filter((i) => i.status === "PAID");

  const overdueTotal = overdue.reduce((s, i) => s + i.totalDueCents, 0);
  const openTotal    = open.reduce((s, i) => s + i.totalDueCents, 0);

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <Link href="/dashboard/admin" className="text-amber-600 text-sm font-medium hover:underline">← Admin Dashboard</Link>
        <span className="text-gray-300">/</span>
        <Link href="/dashboard/admin/net-terms" className="text-amber-600 text-sm font-medium hover:underline">Net Terms</Link>
      </div>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Net Terms Invoices</h1>
        <p className="text-sm text-gray-500 mt-1">Open &amp; overdue invoices across all net terms accounts</p>
      </div>

      {migrationPending && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-800 text-sm">
          <strong>Migration required:</strong> Run{" "}
          <code className="bg-amber-100 px-1 rounded">phase2_net_terms_integrations.sql</code> in Supabase SQL Editor.
        </div>
      )}

      {!migrationPending && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <StatCard label="Overdue" value={`$${(overdueTotal / 100).toLocaleString()}`} count={overdue.length} color="red" />
            <StatCard label="Open (not yet due)" value={`$${(openTotal / 100).toLocaleString()}`} count={open.length} color="amber" />
            <StatCard label="Paid (last 90 days)" value={`${paid.length} invoices`} count={paid.length} color="green" />
          </div>

          {invoices.length === 0 ? (
            <div className="text-center py-12 text-gray-400">No invoices yet.</div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {["Invoice #", "Buyer", "Period", "Due Date", "Amount", "Status", "Escalated"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left font-semibold text-gray-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {invoices.map((inv) => {
                    const daysOverdue = Math.max(0, Math.floor(
                      (Date.now() - new Date(inv.dueDate).getTime()) / 86_400_000
                    ));
                    return (
                      <tr key={inv.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono text-xs text-gray-600">{inv.invoiceNumber}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">
                            {inv.buyer.company ?? inv.buyer.name ?? inv.buyer.email}
                          </div>
                          <div className="text-xs text-gray-400">{inv.buyer.email}</div>
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-xs">
                          {new Date(inv.periodStart).toLocaleDateString()} –{" "}
                          {new Date(inv.periodEnd).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {new Date(inv.dueDate).toLocaleDateString()}
                          {inv.status === "OVERDUE" && (
                            <span className="block text-xs text-red-500">+{daysOverdue}d overdue</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-900">
                          ${(inv.totalDueCents / 100).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            inv.status === "PAID" ? "bg-green-100 text-green-700" :
                            inv.status === "OVERDUE" ? "bg-red-100 text-red-700" :
                            inv.status === "OPEN" ? "bg-amber-100 text-amber-700" :
                            "bg-gray-100 text-gray-600"
                          }`}>
                            {inv.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {inv.escalatedToAdmin ? (
                            <span className="text-red-600 font-medium text-xs">⚠ Yes</span>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
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

function StatCard({
  label, value, count, color,
}: {
  label: string; value: string; count: number; color: "red" | "amber" | "green";
}) {
  const colors = {
    red:   "bg-red-50 border-red-200 text-red-700",
    amber: "bg-amber-50 border-amber-200 text-amber-700",
    green: "bg-green-50 border-green-200 text-green-700",
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <div className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      <div className="text-xs mt-0.5 opacity-70">{count} invoice{count !== 1 ? "s" : ""}</div>
    </div>
  );
}

async function fetchInvoices() {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  return prisma.netTermsInvoice.findMany({
    where: {
      OR: [
        { status: { in: ["OPEN", "OVERDUE"] } },
        { status: "PAID", updatedAt: { gte: ninetyDaysAgo } },
      ],
    },
    include: {
      buyer: { select: { id: true, email: true, name: true, company: true } },
    },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }],
  });
}
