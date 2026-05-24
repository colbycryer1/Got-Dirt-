import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import Link from "next/link";
import { centsToDisplay } from "@/types";
import AMLFlagActions from "./AMLFlagActions";

type FlagWithRelations = Prisma.TransactionFlagGetPayload<{
  include: {
    settlement: {
      include: {
        order: {
          include: {
            pit:   { select: { name: true } };
            buyer: { select: { name: true; company: true; email: true } };
          };
        };
      };
    };
  };
}>;

const FLAG_STYLES: Record<string, string> = {
  UNUSUAL_VOLUME:          "bg-red-100 text-red-700",
  RAPID_LOAD_INCREASE:     "bg-orange-100 text-orange-700",
  NEW_ACCOUNT_HIGH_VOLUME: "bg-purple-100 text-purple-700",
  MANUAL_REVIEW:           "bg-gray-100 text-gray-600",
};

const RESOLUTION_STYLES: Record<string, string> = {
  CLEARED:   "bg-green-100 text-green-700",
  ESCALATED: "bg-amber-100 text-amber-700",
  REPORTED:  "bg-red-100 text-red-700",
};

export default async function AdminAMLPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") redirect("/dashboard");

  let flags: FlagWithRelations[] = [];
  let migrationPending = false;

  try {
    flags = await prisma.transactionFlag.findMany({
      include: {
        settlement: {
          include: {
            order: {
              include: {
                pit:   { select: { name: true } },
                buyer: { select: { name: true, company: true, email: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  } catch {
    migrationPending = true;
  }

  const open     = flags.filter((f) => !f.resolution).length;
  const escalated = flags.filter((f) => f.resolution === "ESCALATED").length;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard/admin" className="text-amber-600 text-sm font-medium">← Admin</Link>
        <span className="font-black text-black text-lg">Got Dirt?</span>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-10 space-y-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">AML Flags</h1>
          {open > 0 && (
            <span className="bg-red-100 text-red-700 text-sm font-semibold px-3 py-1 rounded-full">{open} open</span>
          )}
          {escalated > 0 && (
            <span className="bg-amber-100 text-amber-700 text-sm font-semibold px-3 py-1 rounded-full">{escalated} escalated</span>
          )}
        </div>
        <p className="text-sm text-gray-500 -mt-4">Automatically generated during COB settlement. Review, clear, or escalate each flag.</p>

        {migrationPending && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
            <p className="font-semibold text-amber-800 text-sm">Database migration required</p>
            <p className="text-sm text-amber-700 mt-1">
              Run <code className="bg-amber-100 px-1 rounded font-mono text-xs">prisma/manual-migrations/phase1_compliance.sql</code> in the Supabase SQL Editor to enable AML tracking.
            </p>
          </div>
        )}

        {!migrationPending && flags.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <p className="text-4xl mb-4">✅</p>
            <p className="font-semibold text-gray-600">No AML flags</p>
          </div>
        )}

        {!migrationPending && flags.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {["Date", "Pit", "Buyer", "Flag Type", "Description", "Gross", "Loads", "Resolution", "Actions"].map((h) => (
                    <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {flags.map((f) => (
                  <tr key={f.id} className={`hover:bg-gray-50 ${!f.resolution ? "bg-red-50" : ""}`}>
                    <td className="px-3 py-3 text-gray-500 text-xs whitespace-nowrap">{new Date(f.createdAt).toLocaleDateString()}</td>
                    <td className="px-3 py-3 font-medium text-gray-900">{f.settlement.order.pit.name}</td>
                    <td className="px-3 py-3 text-gray-500 text-xs">
                      {f.settlement.order.buyer.company ?? f.settlement.order.buyer.name ?? f.settlement.order.buyer.email}
                    </td>
                    <td className="px-3 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${FLAG_STYLES[f.flagType] ?? "bg-gray-100 text-gray-500"}`}>
                        {f.flagType.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-gray-600 text-xs max-w-xs">{f.description}</td>
                    <td className="px-3 py-3 text-gray-700 font-medium">{centsToDisplay(f.settlement.grossAmountCents)}</td>
                    <td className="px-3 py-3 text-gray-700">{f.settlement.verifiedLoadCount}</td>
                    <td className="px-3 py-3">
                      {f.resolution ? (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${RESOLUTION_STYLES[f.resolution] ?? ""}`}>
                          {f.resolution}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">Pending</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {!f.resolution && <AMLFlagActions flagId={f.id} />}
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

