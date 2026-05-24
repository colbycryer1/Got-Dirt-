"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

interface ConnectStatus {
  stripeAccountId: string | null;
  stripeOnboarded: boolean;
  kycStatus?: string;
  payoutsEnabled?: boolean;
  chargesEnabled?: boolean;
  requirementsDue?: string[];
}

export default function StripeConnectPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [connectStatus, setConnectStatus] = useState<ConnectStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  const success = searchParams.get("success") === "true";
  const refresh = searchParams.get("refresh") === "true";

  useEffect(() => {
    if (status === "unauthenticated") { router.push("/login"); return; }
    if (status !== "authenticated") return;
    fetchStatus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function fetchStatus() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/connect");
      const data = await res.json();
      setConnectStatus(data);
    } finally {
      setLoading(false);
    }
  }

  async function startOnboarding() {
    setConnecting(true);
    try {
      const res = await fetch("/api/stripe/connect", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } finally {
      setConnecting(false);
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isOnboarded = connectStatus?.stripeOnboarded || connectStatus?.payoutsEnabled;
  const hasPendingRequirements = (connectStatus?.requirementsDue?.length ?? 0) > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard/pit-owner" className="text-amber-600 text-sm font-medium">← Dashboard</Link>
        <span className="font-black text-black text-lg">Got Dirt?</span>
      </nav>

      <div className="max-w-lg mx-auto px-6 py-12 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stripe Payouts</h1>
          <p className="text-sm text-gray-500 mt-1">Connect your bank account to receive daily COB settlements.</p>
        </div>

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-sm text-green-800 font-medium">
            ✓ Stripe onboarding complete. Your account is being verified — payouts will be enabled shortly.
          </div>
        )}

        {refresh && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-800">
            Your onboarding session expired. Click below to continue.
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
          {/* Status */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Account Status</span>
            {isOnboarded ? (
              <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full font-semibold">Active</span>
            ) : connectStatus?.stripeAccountId ? (
              <span className="text-xs bg-amber-100 text-amber-700 px-3 py-1 rounded-full font-semibold">Pending Verification</span>
            ) : (
              <span className="text-xs bg-gray-100 text-gray-500 px-3 py-1 rounded-full font-semibold">Not Connected</span>
            )}
          </div>

          {connectStatus?.payoutsEnabled !== undefined && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Payouts Enabled</span>
              <span className={connectStatus.payoutsEnabled ? "text-green-600 font-medium" : "text-red-500"}>
                {connectStatus.payoutsEnabled ? "Yes" : "No"}
              </span>
            </div>
          )}

          {hasPendingRequirements && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <p className="text-xs font-semibold text-amber-800 mb-1">Outstanding Requirements</p>
              <ul className="text-xs text-amber-700 space-y-0.5 list-disc list-inside">
                {connectStatus!.requirementsDue!.map((r) => <li key={r}>{r}</li>)}
              </ul>
            </div>
          )}

          <div className="pt-2">
            {isOnboarded && !hasPendingRequirements ? (
              <button
                onClick={startOnboarding}
                disabled={connecting}
                className="w-full text-sm text-gray-500 border border-gray-200 rounded-xl py-2.5 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Update Banking Details
              </button>
            ) : (
              <button
                onClick={startOnboarding}
                disabled={connecting}
                className="w-full bg-amber-600 text-white font-semibold py-3 rounded-xl hover:bg-amber-700 disabled:opacity-50 transition-colors"
              >
                {connecting ? "Redirecting…" : connectStatus?.stripeAccountId ? "Continue Onboarding" : "Connect Bank Account"}
              </button>
            )}
          </div>
        </div>

        <div className="text-xs text-gray-400 space-y-1">
          <p>Payouts are processed by Stripe. Got Dirt? never stores your banking details.</p>
          <p>Pits cannot go active on the marketplace until your Stripe account is verified.</p>
        </div>
      </div>
    </div>
  );
}
