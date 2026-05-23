import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { centsToDisplay } from "@/types";

export default async function ContractorDashboard() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const transactions = await prisma.transaction.findMany({
    where: { contractorId: session.user.id },
    include: { pit: { select: { name: true, state: true } }, invoice: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <Link href="/" className="font-bold text-green-700 text-xl">Got Dirt</Link>
        <div className="flex gap-4 text-sm">
          <Link href="/map" className="text-gray-600 hover:text-gray-900">Map</Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">My Transactions</h1>

        {transactions.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <p className="text-gray-400 mb-4">No transactions yet.</p>
            <Link href="/map" className="text-green-600 font-medium hover:underline">
              Find a pit on the map →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.map((tx) => (
              <div key={tx.id} className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{tx.pit.name}</p>
                  <p className="text-sm text-gray-500">
                    {tx.transactionType} · {tx.loads} load{tx.loads > 1 ? "s" : ""} · {new Date(tx.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-gray-900">{centsToDisplay(tx.totalChargeCents)}</p>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    tx.status === "SUCCEEDED" ? "bg-green-100 text-green-700" :
                    tx.status === "FAILED" ? "bg-red-100 text-red-700" :
                    "bg-yellow-100 text-yellow-700"
                  }`}>
                    {tx.status}
                  </span>
                  {tx.invoice && (
                    <Link href={`/api/invoices/${tx.invoice.id}/pdf`} className="text-xs text-green-600 hover:underline block mt-1">
                      Invoice
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
