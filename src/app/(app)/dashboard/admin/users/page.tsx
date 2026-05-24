import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { UserRole } from "@prisma/client";

const ROLE_LABELS: Record<string, string> = {
  ADMIN:      "Admin",
  PIT_OWNER:  "Pit Owner",
  BUYER:      "Buyer",
  CONTRACTOR: "Buyer (legacy)",
  DRIVER:     "Driver",
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN:      "bg-purple-100 text-purple-700",
  PIT_OWNER:  "bg-amber-100 text-amber-700",
  BUYER:      "bg-sky-100 text-sky-700",
  CONTRACTOR: "bg-sky-100 text-sky-600",
  DRIVER:     "bg-stone-100 text-stone-700",
};

export default async function AdminUsersPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") redirect("/dashboard");

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id:             true,
      name:           true,
      email:          true,
      role:           true,
      company:        true,
      phone:          true,
      stripeOnboarded: true,
      createdAt:      true,
      _count: {
        select: {
          pits:         true,
          buyerOrders:  true,
          transactions: true,
        },
      },
    },
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard/admin" className="text-amber-600 text-sm font-medium">← Admin</Link>
        <span className="font-black text-black text-lg">Got Dirt?</span>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Users</h1>
            <p className="text-gray-500 text-sm mt-0.5">{users.length} total accounts</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["Name / Email", "Role", "Company", "Activity", "Stripe", "Joined"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{u.name ?? "—"}</p>
                    <p className="text-xs text-gray-400">{u.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <RoleBadge role={u.role} />
                  </td>
                  <td className="px-4 py-3 text-gray-600">{u.company ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="text-xs text-gray-500 space-y-0.5">
                      {u._count.pits > 0 && (
                        <p>{u._count.pits} pit{u._count.pits !== 1 ? "s" : ""}</p>
                      )}
                      {u._count.buyerOrders > 0 && (
                        <p>{u._count.buyerOrders} order{u._count.buyerOrders !== 1 ? "s" : ""}</p>
                      )}
                      {u._count.transactions > 0 && (
                        <p>{u._count.transactions} transaction{u._count.transactions !== 1 ? "s" : ""}</p>
                      )}
                      {u._count.pits === 0 && u._count.buyerOrders === 0 && u._count.transactions === 0 && (
                        <p className="text-gray-300">No activity</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {u.role === "PIT_OWNER" ? (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${u.stripeOnboarded ? "bg-sky-100 text-sky-700" : "bg-gray-100 text-gray-500"}`}>
                        {u.stripeOnboarded ? "Connected" : "Not connected"}
                      </span>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {users.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <p className="font-semibold text-gray-500">No users yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RoleBadge({ role }: { role: UserRole }) {
  const label = ROLE_LABELS[role] ?? role;
  const color = ROLE_COLORS[role] ?? "bg-gray-100 text-gray-600";
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${color}`}>
      {label}
    </span>
  );
}
