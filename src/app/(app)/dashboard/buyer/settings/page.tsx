import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import IntegrationCard from "./IntegrationCard";

export default async function BuyerSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  const isBuyer = session.user.role === "BUYER" || session.user.role === "CARRIER" || session.user.role === "CONTRACTOR";
  if (!isBuyer && session.user.role !== "ADMIN") redirect("/dashboard");

  let connections: Awaited<ReturnType<typeof fetchConnections>> = [];
  let migrationPending = false;
  try {
    connections = await fetchConnections(session.user.id);
  } catch {
    migrationPending = true;
  }

  let netTermsAccount: Awaited<ReturnType<typeof fetchNetTerms>> | null = null;
  if (!migrationPending) {
    try {
      netTermsAccount = await fetchNetTerms(session.user.id);
    } catch {
      // migration not run yet — silent
    }
  }

  const procore = connections.find((c) => c.platform === "PROCORE");
  const acc     = connections.find((c) => c.platform === "ACC");

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard/buyer" className="text-amber-600 hover:text-amber-700 text-sm font-medium">← Dashboard</Link>
        <span className="font-black text-black text-lg">Got Dirt?</span>
      </nav>
      <div className="max-w-3xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Integrations &amp; Settings</h1>
        <p className="text-sm text-gray-500 mt-1">
          Connect Got Dirt to your construction management software for automatic cost syncing.
        </p>
      </div>

      {migrationPending && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-800 text-sm">
          Integrations require a database migration. Please contact your administrator.
        </div>
      )}

      {/* Payment Terms */}
      {netTermsAccount && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-800 mb-3">Payment Terms</h2>
          <div className="flex gap-6">
            <div>
              <div className="text-xs text-gray-500 font-semibold uppercase">Terms</div>
              <div className="text-lg font-bold text-gray-900 mt-0.5">NET {netTermsAccount.termsDays}</div>
            </div>
            {netTermsAccount.creditLimitCents && (
              <div>
                <div className="text-xs text-gray-500 font-semibold uppercase">Credit Limit</div>
                <div className="text-lg font-bold text-gray-900 mt-0.5">
                  ${(netTermsAccount.creditLimitCents / 100).toLocaleString()}
                </div>
              </div>
            )}
            {netTermsAccount.downPaymentPct > 0 && (
              <div>
                <div className="text-xs text-gray-500 font-semibold uppercase">Down Payment</div>
                <div className="text-lg font-bold text-gray-900 mt-0.5">{netTermsAccount.downPaymentPct}%</div>
              </div>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Net terms are assigned by Got Dirt administration. Contact us to adjust your terms.
          </p>
        </div>
      )}

      {/* Integrations */}
      {!migrationPending && (
        <div className="space-y-4">
          <h2 className="font-semibold text-gray-800">Connected Integrations</h2>

          <IntegrationCard
            platform="PROCORE"
            name="Procore"
            description="Automatically push settlements as Direct Costs to Procore projects."
            logo="🏗"
            connected={!!procore}
            connectedAt={procore?.createdAt ?? null}
            lastSyncAt={procore?.lastSyncAt ?? null}
            lastSyncError={procore?.lastSyncError ?? null}
            connectHref="/api/integrations/procore/connect"
            disconnectEndpoint="/api/integrations/procore/disconnect"
          />

          <IntegrationCard
            platform="ACC"
            name="Autodesk Construction Cloud"
            description="Push load costs to ACC Cost Management budget line items."
            logo="📐"
            connected={!!acc}
            connectedAt={acc?.createdAt ?? null}
            lastSyncAt={acc?.lastSyncAt ?? null}
            lastSyncError={acc?.lastSyncError ?? null}
            connectHref="/api/integrations/acc/connect"
            disconnectEndpoint="/api/integrations/acc/disconnect"
          />
        </div>
      )}
    </div>
      </div>
    </div>
  );
}

async function fetchConnections(buyerUserId: string) {
  return prisma.integrationConnection.findMany({
    where: { buyerUserId },
    select: {
      id: true,
      platform: true,
      platformUserId: true,
      platformCompanyId: true,
      lastSyncAt: true,
      lastSyncError: true,
      createdAt: true,
    },
  });
}

async function fetchNetTerms(buyerUserId: string) {
  return prisma.netTermsAccount.findUnique({
    where: { buyerUserId },
    select: { termsDays: true, creditLimitCents: true, downPaymentPct: true },
  });
}
