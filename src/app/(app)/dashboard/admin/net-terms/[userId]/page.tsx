import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import NetTermsEditForm from "./NetTermsEditForm";

export default async function NetTermsDetailPage({ params }: { params: { userId: string } }) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");

  let account: Awaited<ReturnType<typeof fetchAccount>> | null = null;
  try {
    account = await fetchAccount(params.userId);
  } catch {
    notFound();
  }
  if (!account) notFound();

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/admin/net-terms" className="text-gray-400 hover:text-gray-600">
          ← Net Terms
        </Link>
        <h1 className="text-xl font-bold text-gray-900">
          {account.buyer.company ?? account.buyer.name ?? account.buyer.email}
        </h1>
        <span className="text-sm text-gray-500">{account.buyer.email}</span>
      </div>

      <NetTermsEditForm account={account} />

      {account.netTermsInvoices.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 font-semibold text-gray-700 text-sm">Invoice History</div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {["Invoice #", "Period", "Due", "Amount", "Status"].map((h) => (
                  <th key={h} className="px-4 py-2 text-left font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {account.netTermsInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono text-xs">{inv.invoiceNumber}</td>
                  <td className="px-4 py-2 text-gray-600">
                    {new Date(inv.periodStart).toLocaleDateString()} – {new Date(inv.periodEnd).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2 text-gray-600">{new Date(inv.dueDate).toLocaleDateString()}</td>
                  <td className="px-4 py-2 font-medium">${(inv.totalDueCents / 100).toLocaleString()}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      inv.status === "PAID" ? "bg-green-100 text-green-700" :
                      inv.status === "OVERDUE" ? "bg-red-100 text-red-700" :
                      inv.status === "OPEN" ? "bg-amber-100 text-amber-700" :
                      "bg-gray-100 text-gray-600"
                    }`}>
                      {inv.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

async function fetchAccount(userId: string) {
  return prisma.netTermsAccount.findUnique({
    where: { buyerUserId: userId },
    include: {
      buyer: { select: { id: true, email: true, name: true, company: true } },
      netTermsInvoices: {
        orderBy: { periodStart: "desc" },
        take: 50,
        select: {
          id: true, invoiceNumber: true, periodStart: true, periodEnd: true,
          dueDate: true, totalDueCents: true, status: true,
        },
      },
    },
  });
}
