import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import DisputeActions from "./DisputeActions";

export default async function AdminDisputesPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") redirect("/dashboard");

  const disputed = await prisma.loadEvent.findMany({
    where: { disputed: true },
    include: {
      pit:   { select: { name: true } },
      order: { select: { buyer: { select: { name: true, company: true, email: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard/admin" className="text-amber-600 text-sm font-medium">← Admin</Link>
        <span className="font-black text-black text-lg">Got Dirt?</span>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Disputed Loads</h1>
          {disputed.length > 0 && (
            <span className="bg-red-100 text-red-700 text-sm font-semibold px-3 py-1 rounded-full">
              {disputed.length} open
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500 -mt-4">
          Disputed loads are excluded from COB settlements until resolved by admin.
        </p>

        {disputed.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <p className="text-4xl mb-4">✅</p>
            <p className="font-semibold text-gray-600">No disputed loads</p>
            <p className="text-sm text-gray-400 mt-1">All clear.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {["Time", "Pit", "Buyer", "Material", "Method", "Notes", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {disputed.map((l) => (
                  <tr key={l.id} className="bg-red-50 hover:bg-red-100/50">
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {new Date(l.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{l.pit.name}</td>
                    <td className="px-4 py-3 text-gray-600">{l.order.buyer.company ?? l.order.buyer.name ?? l.order.buyer.email}</td>
                    <td className="px-4 py-3 text-gray-600">{l.materialType}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${l.verificationMethod === "OPERATOR" ? "bg-amber-100 text-amber-700" : "bg-sky-100 text-sky-700"}`}>
                        {l.verificationMethod === "OPERATOR" ? "Manual" : "GPS"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{l.notes ?? "—"}</td>
                    <td className="px-4 py-3">
                      <DisputeActions loadId={l.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
