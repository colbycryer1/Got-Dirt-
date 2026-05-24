import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import Link from "next/link";

type PitOwnerWithCompliance = Prisma.UserGetPayload<{
  include: {
    pitOwnerCompliance: true;
    pits: { select: { id: true; status: true } };
  };
}>;

const KYC_STYLES: Record<string, string> = {
  VERIFIED:    "bg-green-100 text-green-700",
  PENDING:     "bg-amber-100 text-amber-700",
  NOT_STARTED: "bg-gray-100 text-gray-500",
  REJECTED:    "bg-red-100 text-red-700",
};

export default async function AdminKYCPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") redirect("/dashboard");

  let pitOwners: PitOwnerWithCompliance[] = [];
  let migrationPending = false;

  try {
    pitOwners = await prisma.user.findMany({
      where: { role: "PIT_OWNER" },
      include: {
        pitOwnerCompliance: true,
        pits: { select: { id: true, status: true }, where: { status: "ACTIVE" } },
      },
      orderBy: { createdAt: "desc" },
    });
  } catch {
    migrationPending = true;
  }

  const verified    = pitOwners.filter((u) => u.pitOwnerCompliance?.kycStatus === "VERIFIED").length;
  const pending     = pitOwners.filter((u) => u.pitOwnerCompliance?.kycStatus === "PENDING").length;
  const notStarted  = pitOwners.filter((u) => !u.pitOwnerCompliance || u.pitOwnerCompliance.kycStatus === "NOT_STARTED").length;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard/admin" className="text-amber-600 text-sm font-medium">← Admin</Link>
        <span className="font-black text-black text-lg">Got Dirt?</span>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-10 space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">KYC Status — Pit Owners</h1>

        {migrationPending && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
            <p className="font-semibold text-amber-800 text-sm">Database migration required</p>
            <p className="text-sm text-amber-700 mt-1">
              Run <code className="bg-amber-100 px-1 rounded font-mono text-xs">prisma/manual-migrations/phase1_compliance.sql</code> in the Supabase SQL Editor to enable KYC tracking.
            </p>
          </div>
        )}

        {/* KPI row */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-5 text-center">
            <p className="text-3xl font-black text-green-600">{verified}</p>
            <p className="text-sm text-gray-500 mt-1">Verified</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-5 text-center">
            <p className="text-3xl font-black text-amber-600">{pending}</p>
            <p className="text-sm text-gray-500 mt-1">Pending</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-5 text-center">
            <p className="text-3xl font-black text-gray-400">{notStarted}</p>
            <p className="text-sm text-gray-500 mt-1">Not Started</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {pitOwners.length === 0 ? (
            <p className="p-10 text-center text-gray-400">No pit owners yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {["Pit Owner", "Email", "Active Pits", "Payouts", "Charges", "KYC Status", "Outstanding", "Last Checked"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pitOwners.map((u) => {
                  const c = u.pitOwnerCompliance;
                  const kycStatus = c?.kycStatus ?? "NOT_STARTED";
                  return (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{u.name ?? "—"}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{u.email}</td>
                      <td className="px-4 py-3 text-gray-700">{u.pits.length}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium ${c?.payoutsEnabled ? "text-green-600" : "text-red-500"}`}>
                          {c?.payoutsEnabled ? "Enabled" : "Disabled"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium ${c?.chargesEnabled ? "text-green-600" : "text-red-500"}`}>
                          {c?.chargesEnabled ? "Enabled" : "Disabled"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${KYC_STYLES[kycStatus] ?? "bg-gray-100 text-gray-500"}`}>
                          {kycStatus.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {(c?.requirementsDue?.length ?? 0) > 0
                          ? <span className="text-amber-600 font-medium">{c!.requirementsDue.length} item(s)</span>
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {c?.lastCheckedAt ? new Date(c.lastCheckedAt).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
