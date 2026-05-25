"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

interface BankingStatus {
  stripeAccountId: string | null;
  payoutsEnabled:  boolean;
  chargesEnabled:  boolean;
  requirementsDue: string[];
}

export default function DriverBankingPage() {
  const searchParams = useSearchParams();
  const [status,     setStatus]     = useState<BankingStatus | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error,      setError]      = useState("");

  const justReturned = searchParams.get("success") === "true";

  useEffect(() => {
    fetch("/api/driver/banking")
      .then((r) => r.json())
      .then((d) => setStatus(d as BankingStatus))
      .catch(() => setError("Failed to load banking status."))
      .finally(() => setLoading(false));
  }, []);

  async function startOnboarding() {
    setConnecting(true);
    setError("");
    try {
      const res = await fetch("/api/driver/banking", { method: "POST" });
      const d   = await res.json() as { url?: string; error?: string };
      if (!res.ok) throw new Error(d.error ?? "Failed");
      if (d.url) window.location.href = d.url;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setConnecting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard/driver" className="text-amber-600 hover:text-amber-700 text-sm font-medium">
          ← Dashboard
        </Link>
        <span className="text-gray-300">|</span>
        <Link href="/" className="font-black text-black text-lg">Got Dirt?</Link>
      </nav>

      <div className="max-w-xl mx-auto px-6 py-12 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Banking & Payouts</h1>
          <p className="text-gray-500 mt-1">
            Connect your bank account to receive direct deposits for completed haul jobs.
          </p>
        </div>

        {justReturned && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
            <p className="font-semibold text-green-800">✓ Banking information submitted</p>
            <p className="text-sm text-green-700 mt-0.5">
              Stripe is reviewing your account. Payouts will be enabled once verification is complete.
            </p>
          </div>
        )}

        {loading && (
          <div className="bg-white rounded-2xl border border-gray-200 p-10 flex justify-center">
            <div className="animate-spin w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full" />
          </div>
        )}

        {!loading && status && (
          <div className="space-y-6">

            {/* Status card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-gray-700">Payout Status</p>
                {status.payoutsEnabled ? (
                  <span className="bg-green-100 text-green-700 text-sm font-bold px-3 py-1 rounded-full">
                    ✓ Active
                  </span>
                ) : status.stripeAccountId ? (
                  <span className="bg-amber-100 text-amber-700 text-sm font-bold px-3 py-1 rounded-full">
                    Pending Review
                  </span>
                ) : (
                  <span className="bg-gray-100 text-gray-500 text-sm font-bold px-3 py-1 rounded-full">
                    Not Connected
                  </span>
                )}
              </div>

              {status.payoutsEnabled && (
                <div className="bg-green-50 rounded-xl p-4">
                  <p className="text-sm text-green-700 font-medium">
                    Your bank account is connected. Payouts will be deposited automatically after each completed haul.
                  </p>
                </div>
              )}

              {status.requirementsDue.length > 0 && (
                <div className="bg-amber-50 rounded-xl p-4">
                  <p className="text-sm font-semibold text-amber-800 mb-2">Action required:</p>
                  <ul className="space-y-1">
                    {status.requirementsDue.map((r) => (
                      <li key={r} className="text-sm text-amber-700">• {r.replace(/_/g, " ")}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* How it works */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-3">
              <p className="font-semibold text-gray-700">How payouts work</p>
              <ol className="space-y-2 text-sm text-gray-600">
                {[
                  "Accept a haul order from a buyer",
                  "Complete the job — loads are logged and verified",
                  "Got Dirt? processes the payment and transfers your earnings",
                  "Funds land in your bank account via Stripe",
                ].map((step, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            {/* CTA */}
            {!status.payoutsEnabled && (
              <button
                onClick={startOnboarding}
                disabled={connecting}
                className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold py-4 rounded-2xl transition-colors text-lg"
              >
                {connecting
                  ? "Opening Stripe…"
                  : status.stripeAccountId
                  ? "Continue Setup in Stripe →"
                  : "Set Up Direct Deposit →"}
              </button>
            )}

            {status.payoutsEnabled && (
              <button
                onClick={startOnboarding}
                disabled={connecting}
                className="w-full bg-white border border-gray-300 text-gray-600 font-semibold py-3 rounded-2xl hover:bg-gray-50 transition-colors"
              >
                {connecting ? "Opening Stripe…" : "Manage Bank Account in Stripe →"}
              </button>
            )}

          </div>
        )}

      </div>
    </div>
  );
}
