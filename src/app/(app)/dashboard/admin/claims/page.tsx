import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import ClaimActions from "./ClaimActions";

export default async function AdminClaimsPage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");

  let claims: Awaited<ReturnType<typeof fetchClaims>> = [];
  let migrationPending = false;
  try {
    claims = await fetchClaims();
  } catch {
    migrationPending = true;
  }

  const pending  = claims.filter((c) => c.status === "PENDING");
  const reviewed = claims.filter((c) => c.status !== "PENDING");

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <Link href="/dashboard/admin" className="text-amber-600 text-sm font-medium hover:underline">
          ← Admin Dashboard
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pit Ownership Claims</h1>
          <p className="text-sm text-gray-500 mt-1">
            Pit owners claiming admin-uploaded pits. Approve to transfer ownership.
          </p>
        </div>
        {pending.length > 0 && (
          <span className="bg-amber-100 text-amber-700 text-sm font-semibold px-3 py-1 rounded-full">
            {pending.length} pending
          </span>
        )}
      </div>

      {migrationPending && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-800 text-sm">
          <strong>Migration required:</strong> Run{" "}
          <code className="bg-amber-100 px-1 rounded">phase3_claims_saved_pits.sql</code> in Supabase SQL Editor.
        </div>
      )}

      {!migrationPending && (
        <>
          {pending.length === 0 && reviewed.length === 0 && (
            <div className="text-center py-12 text-gray-400">No claims submitted yet.</div>
          )}

          {pending.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-semibold text-gray-800">Pending Review</h2>
              {pending.map((c) => (
                <ClaimCard key={c.id} claim={c} showActions />
              ))}
            </div>
          )}

          {reviewed.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide mt-4">
                Previously Reviewed
              </h2>
              {reviewed.map((c) => (
                <ClaimCard key={c.id} claim={c} showActions={false} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

type Claim = Awaited<ReturnType<typeof fetchClaims>>[number];

function ClaimCard({ claim, showActions }: { claim: Claim; showActions: boolean }) {
  return (
    <div className={`bg-white rounded-xl border p-5 space-y-3 ${
      claim.status === "PENDING" ? "border-amber-200" : "border-gray-200"
    }`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-semibold text-gray-900">{claim.pit.name}</div>
          {claim.pit.address && (
            <div className="text-sm text-gray-500">{claim.pit.address}, {claim.pit.state}</div>
          )}
        </div>
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${
          claim.status === "PENDING"  ? "bg-amber-100 text-amber-700" :
          claim.status === "APPROVED" ? "bg-green-100 text-green-700" :
                                        "bg-red-100 text-red-700"
        }`}>
          {claim.status}
        </span>
      </div>

      <div className="text-sm text-gray-600">
        <span className="font-medium">Claimant: </span>
        {claim.claimant.company ?? claim.claimant.name ?? claim.claimant.email}
        <span className="text-gray-400 ml-1">({claim.claimant.email})</span>
      </div>

      {claim.message && (
        <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 italic">
          &quot;{claim.message}&quot;
        </div>
      )}

      {claim.adminNotes && claim.status !== "PENDING" && (
        <div className="text-xs text-gray-500">
          <span className="font-medium">Admin note: </span>{claim.adminNotes}
        </div>
      )}

      <div className="text-xs text-gray-400">
        Submitted {new Date(claim.createdAt).toLocaleString()}
      </div>

      {showActions && <ClaimActions claimId={claim.id} />}
    </div>
  );
}

async function fetchClaims() {
  return prisma.pitClaim.findMany({
    include: {
      pit:      { select: { name: true, address: true, state: true } },
      claimant: { select: { email: true, name: true, company: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
}
