import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { centsToDisplay, pitTypeLabel } from "@/types";
import { PitStatusToggle } from "@/components/pit/PitStatusToggle";

export default async function AdminPitsPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") redirect("/dashboard");

  const pits = await prisma.pit.findMany({
    orderBy: { createdAt: "desc" },
    include: { owner: { select: { name: true, email: true } } },
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <Link href="/dashboard/admin" className="text-green-600 text-sm font-medium">← Admin</Link>
        <div className="flex gap-3">
          <Link href="/dashboard/admin/upload" className="border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg text-sm hover:bg-gray-50">
            Import KMZ
          </Link>
          <Link href="/dashboard/admin/pits/new" className="bg-green-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-green-700">
            + Add Pit
          </Link>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">All Pits</h1>
        <p className="text-gray-500 text-sm mb-8">{pits.length} pits total</p>

        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {["Name", "Type", "State", "Owner", "Dump Rate", "Borrow Rate", "Status", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pits.map((pit) => (
                  <tr key={pit.id} className={`hover:bg-gray-50 ${pit.status === "INACTIVE" ? "opacity-50" : ""}`}>
                    <td className="px-4 py-3 font-medium text-gray-900">{pit.name}</td>
                    <td className="px-4 py-3 text-gray-500">{pitTypeLabel(pit.pitType)}</td>
                    <td className="px-4 py-3 text-gray-500">{pit.state}</td>
                    <td className="px-4 py-3 text-gray-500">{pit.owner?.name ?? pit.owner?.email ?? <span className="text-gray-300">Unassigned</span>}</td>
                    <td className="px-4 py-3 text-gray-500">{pit.dumpRateCents ? centsToDisplay(pit.dumpRateCents) : "—"}</td>
                    <td className="px-4 py-3 text-gray-500">{pit.borrowRateCents ? centsToDisplay(pit.borrowRateCents) : "—"}</td>
                    <td className="px-4 py-3">
                      <PitStatusToggle pitId={pit.id} initialAccepting={pit.accepting} />
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/admin/pits/${pit.id}/edit`} className="text-green-600 hover:underline text-xs">
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
