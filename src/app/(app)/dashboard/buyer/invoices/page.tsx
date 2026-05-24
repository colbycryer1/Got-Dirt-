import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Invoices — Got Dirt?" };

export default async function InvoicesPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const [transactions, settlements, netTermsInvoices] = await Promise.all([
    // One-time pay transactions
    prisma.transaction.findMany({
      where:   { contractorId: session.user.id, status: "SUCCEEDED" },
      include: {
        pit:     { select: { name: true } },
        invoice: { select: { invoiceNumber: true, pdfUrl: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    // COB order settlements
    prisma.settlement.findMany({
      where:   { order: { buyerUserId: session.user.id }, status: "PROCESSED" },
      include: {
        order: {
          select: {
            date:    true,
            pit:     { select: { name: true } },
            project: { select: { name: true } },
          },
        },
      },
      orderBy: { date: "desc" },
      take: 100,
    }),
    // Net terms invoices
    prisma.netTermsInvoice.findMany({
      where:   { buyerUserId: session.user.id },
      orderBy: { periodStart: "desc" },
      take: 50,
    }).catch(() => []),
  ]);

  const totalPaid =
    transactions.reduce((s, t) => s + t.subtotalCents, 0) +
    settlements.reduce((s, t) => s + t.grossAmountCents, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard/buyer" className="text-amber-600 hover:text-amber-700 text-sm font-medium">
          ← Dashboard
        </Link>
        <span className="text-gray-300">|</span>
        <Link href="/" className="font-black text-black text-lg">Got Dirt?</Link>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Invoices & Payments</h1>
          <div className="text-right">
            <p className="text-2xl font-black text-gray-900">${(totalPaid / 100).toFixed(2)}</p>
            <p className="text-xs text-gray-400">total paid</p>
          </div>
        </div>

        {/* One-time transaction invoices */}
        {transactions.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">One-Time Payments</h2>
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {["Invoice", "Pit", "Type", "Loads", "Amount", ""].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {transactions.map((t) => (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">{t.invoice?.invoiceNumber ?? "—"}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{t.pit.name}</td>
                      <td className="px-4 py-3 text-gray-500 capitalize">{t.transactionType.toLowerCase()}</td>
                      <td className="px-4 py-3 text-gray-500">{t.loads}</td>
                      <td className="px-4 py-3 font-semibold text-gray-900">${(t.subtotalCents / 100).toFixed(2)}</td>
                      <td className="px-4 py-3">
                        {t.invoice?.pdfUrl ? (
                          <a href={t.invoice.pdfUrl} target="_blank" rel="noopener noreferrer"
                            className="text-amber-600 hover:underline text-xs font-medium">PDF ↓</a>
                        ) : (
                          <span className="text-gray-300 text-xs">No PDF</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* COB daily settlements */}
        {settlements.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Daily Settlements</h2>
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {["Date", "Project", "Pit", "Loads", "Amount"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {settlements.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-600">
                        {new Date(s.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{s.order.project.name}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{s.order.pit.name}</td>
                      <td className="px-4 py-3 text-gray-500">{s.verifiedLoadCount}</td>
                      <td className="px-4 py-3 font-semibold text-gray-900">${(s.grossAmountCents / 100).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Net terms invoices */}
        {netTermsInvoices.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Net Terms Invoices</h2>
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {["Period", "Amount", "Due", "Status"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {netTermsInvoices.map((inv) => {
                    const statusStyle =
                      inv.status === "PAID" ? "bg-green-100 text-green-700" :
                      inv.status === "OVERDUE" ? "bg-red-100 text-red-700" :
                      inv.status === "WRITTEN_OFF" ? "bg-gray-100 text-gray-500" :
                      "bg-amber-100 text-amber-700";
                    return (
                      <tr key={inv.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-600">
                          {new Date(inv.periodStart).toLocaleDateString("en-US", { month: "short", day: "numeric" })} –{" "}
                          {new Date(inv.periodEnd).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-900">${(inv.totalDueCents / 100).toFixed(2)}</td>
                        <td className="px-4 py-3 text-gray-500">
                          {new Date(inv.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${statusStyle}`}>{inv.status}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {transactions.length === 0 && settlements.length === 0 && netTermsInvoices.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <p className="text-gray-500 font-medium mb-1">No payment history yet</p>
            <p className="text-sm text-gray-400">Your invoices and charges will appear here after your first order.</p>
          </div>
        )}
      </div>
    </div>
  );
}
