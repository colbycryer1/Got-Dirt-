import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import NetTermsAssignForm from "./NetTermsAssignForm";

export default async function AdminNetTermsPage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");

  let accounts: Awaited<ReturnType<typeof fetchAccounts>> = [];
  let migrationPending = false;

  try {
    accounts = await fetchAccounts();
  } catch {
    migrationPending = true;
  }

  const buyers = await prisma.user.findMany({
    where: { role: { in: ["BUYER", "CONTRACTOR"] } },
    select: { id: true, email: true, name: true, company: true },
    orderBy: { email: "asc" },
  });

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Net Terms Accounts</h1>
          <p className="text-sm text-gray-500 mt-1">Admin-assigned payment terms for qualifying buyers</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/dashboard/admin/net-terms/invoices"
            className="px-4 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 font-medium"
          >
            Open Invoices
          </Link>
          <Link
            href="/dashboard/admin/net-terms/exposure"
            className="px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium"
          >
            Exposure View
          </Link>
        </div>
      </div>

      {migrationPending && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-800 text-sm">
          <strong>Migration required:</strong> Run{" "}
          <code className="bg-amber-100 px-1 rounded">phase2_net_terms_integrations.sql</code> in Supabase SQL Editor.
        </div>
      )}

      {!migrationPending && (
        <NetTermsAssignForm buyers={buyers} />
      )}

      {!migrationPending && accounts.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["Buyer", "Terms", "Credit Limit", "Down Payment %", "Open Invoices", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-semibold text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {accounts.map((acc) => {
                const openInvoices = acc.netTermsInvoices;
                const openTotal = openInvoices.reduce((s, i) => s + i.totalDueCents, 0);
                return (
                  <tr key={acc.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{acc.buyer.company ?? acc.buyer.name ?? acc.buyer.email}</div>
                      <div className="text-xs text-gray-400">{acc.buyer.email}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">NET {acc.termsDays}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {acc.creditLimitCents
                        ? `$${(acc.creditLimitCents / 100).toLocaleString()}`
                        : <span className="text-gray-400">No limit</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{acc.downPaymentPct}%</td>
                    <td className="px-4 py-3">
                      {openInvoices.length > 0 ? (
                        <span className="text-amber-700 font-medium">
                          {openInvoices.length} invoice{openInvoices.length > 1 ? "s" : ""} — ${(openTotal / 100).toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-gray-400">None</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/admin/net-terms/${acc.buyerUserId}`}
                        className="text-amber-600 hover:underline font-medium"
                      >
                        Edit →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!migrationPending && accounts.length === 0 && (
        <div className="text-center py-12 text-gray-400">No net terms accounts assigned yet.</div>
      )}
    </div>
  );
}

async function fetchAccounts() {
  return prisma.netTermsAccount.findMany({
    include: {
      buyer: { select: { id: true, email: true, name: true, company: true } },
      netTermsInvoices: {
        where: { status: { in: ["OPEN", "OVERDUE"] } },
        select: { id: true, totalDueCents: true, dueDate: true, status: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}
