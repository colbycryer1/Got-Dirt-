"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

interface Amendment {
  id: string;
  requestedLoads: number;
  originalLoads: number;
  status: string;
  haulerApproved: boolean | null;
  pitOwnerApproved: boolean | null;
  reason: string | null;
  processingFeeCents: number;
}

interface Props {
  orderId:        string;
  estimatedLoads: number;
  haulRateCents:  number;
  createdAt:      string; // ISO string
}

type Step = "idle" | "enter" | "confirm" | "amendment-form" | "amendment-pending" | "amendment-approved";

export default function CompleteHaulButton({ orderId, estimatedLoads, haulRateCents, createdAt }: Props) {
  const router = useRouter();
  const [step,         setStep]         = useState<Step>("idle");
  const [actualLoads,  setActualLoads]  = useState(estimatedLoads);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState("");
  const [logCount,     setLogCount]     = useState<number | null>(null);
  const [logPitName,   setLogPitName]   = useState<string | null>(null);
  const [amendment,    setAmendment]    = useState<Amendment | null>(null);
  const [amendReason,  setAmendReason]  = useState("");
  const fetchedRef = useRef(false);

  const fmt = (cents: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

  const hoursSincePlaced = (Date.now() - new Date(createdAt).getTime()) / 1000 / 3600;
  const within24h = hoursSincePlaced < 24;

  // Fetch load log count + any existing amendments when entering the enter step
  useEffect(() => {
    if (step !== "enter" || fetchedRef.current) return;
    fetchedRef.current = true;

    Promise.all([
      fetch(`/api/haul-orders/${orderId}/load-log-count`).then((r) => r.json()),
      fetch(`/api/haul-orders/${orderId}/amendments`).then((r) => r.json()),
    ]).then(([logData, amendData]) => {
      if (typeof logData.count === "number") {
        setLogCount(logData.count);
        setLogPitName(logData.pitName ?? null);
        if (logData.count > 0) setActualLoads(logData.count);
      }
      if (amendData.amendments?.length > 0) {
        const latest = amendData.amendments[0] as Amendment;
        setAmendment(latest);
        if (latest.status === "PENDING")  setStep("amendment-pending");
        if (latest.status === "APPROVED") {
          setActualLoads(latest.requestedLoads);
          setStep("amendment-approved");
        }
      }
    }).catch(() => {/* silently ignore */});
  }, [step, orderId]);

  const actualTotal    = actualLoads * haulRateCents;
  const estimatedTotal = estimatedLoads * haulRateCents;
  const delta          = actualTotal - estimatedTotal;

  async function complete() {
    setLoading(true);
    setError("");
    try {
      const res  = await fetch(`/api/haul-orders/${orderId}/complete`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ actualLoads }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to complete order");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to complete order");
      setLoading(false);
      setStep("confirm");
    }
  }

  async function submitAmendment() {
    setLoading(true);
    setError("");
    try {
      const res  = await fetch(`/api/haul-orders/${orderId}/amendments`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ requestedLoads: actualLoads, reason: amendReason }),
      });
      const data = await res.json() as { amendment?: Amendment; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to submit amendment");
      setAmendment(data.amendment ?? null);
      setStep("amendment-pending");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to submit request");
    } finally {
      setLoading(false);
    }
  }

  function handleReviewClick() {
    if (actualLoads > estimatedLoads) {
      if (amendment?.status === "APPROVED") {
        setStep("amendment-approved");
      } else if (amendment?.status === "PENDING") {
        setStep("amendment-pending");
      } else {
        setStep("amendment-form");
      }
    } else {
      setStep("confirm");
    }
  }

  // ── idle ──────────────────────────────────────────────────────────────────
  if (step === "idle") {
    return (
      <button
        onClick={() => setStep("enter")}
        className="text-sm font-semibold text-green-700 hover:text-green-800 transition-colors"
      >
        Mark as Completed →
      </button>
    );
  }

  // ── enter loads ───────────────────────────────────────────────────────────
  if (step === "enter") {
    return (
      <div className="space-y-3">
        {/* Load Log pre-population note */}
        {logCount !== null && (
          <div className={`text-xs px-3 py-2 rounded-lg ${logCount > 0 ? "bg-blue-50 text-blue-700" : "bg-gray-50 text-gray-500"}`}>
            {logCount > 0
              ? `Load Log recorded ${logCount} load${logCount !== 1 ? "s" : ""}${logPitName ? ` at ${logPitName}` : ""} on this date.`
              : `No load events found in the Load Log for this date${logPitName ? ` at ${logPitName}` : ""}.`}
          </div>
        )}

        <p className="text-xs font-semibold text-gray-600">Confirm actual loads completed:</p>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min="0"
            value={actualLoads}
            onChange={(e) => setActualLoads(Math.max(0, parseInt(e.target.value) || 0))}
            className="w-24 border border-gray-300 rounded-lg px-3 py-1.5 text-sm font-bold text-center focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          <span className="text-xs text-gray-400">(estimated: {estimatedLoads})</span>
        </div>

        {/* Cost delta preview */}
        <div className="bg-gray-50 rounded-xl p-3 text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-gray-500">You will be charged</span>
            <span className="font-bold text-gray-900">{fmt(actualTotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Original estimate</span>
            <span className="text-gray-400 line-through">{fmt(estimatedTotal)}</span>
          </div>
          {delta !== 0 && (
            <div className={`flex justify-between font-semibold ${delta > 0 ? "text-amber-600" : "text-green-700"}`}>
              <span>{delta > 0 ? "Extra charge (needs approval)" : "Savings"}</span>
              <span>{delta > 0 ? "+" : ""}{fmt(Math.abs(delta))}</span>
            </div>
          )}
          {actualLoads > estimatedLoads && (
            <p className="text-xs text-amber-600 pt-1">
              Extra loads require approval from your hauler and pit owner before billing.
            </p>
          )}
        </div>

        {within24h && (
          <p className="text-xs text-gray-400 italic">
            Order placed within 24 hours — edits may incur a small processing fee.
          </p>
        )}

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={handleReviewClick}
            className="bg-green-600 text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-green-700 transition-colors"
          >
            {actualLoads > estimatedLoads ? "Request Extra Loads →" : "Review & Confirm →"}
          </button>
          <button
            onClick={() => { setStep("idle"); setActualLoads(estimatedLoads); fetchedRef.current = false; }}
            className="text-xs text-gray-400 hover:text-gray-600 px-2"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ── amendment form (extra loads — needs approval) ─────────────────────────
  if (step === "amendment-form") {
    return (
      <div className="space-y-3">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
          <p className="font-semibold text-amber-800 text-sm">Extra Loads Request</p>
          <p className="text-xs text-amber-700">
            You are requesting {actualLoads - estimatedLoads} additional load{actualLoads - estimatedLoads !== 1 ? "s" : ""} ({estimatedLoads} → {actualLoads}).
            Your hauler and pit owner must approve before the extra {fmt(delta)} is charged.
          </p>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1">Reason (optional)</label>
          <textarea
            value={amendReason}
            onChange={(e) => setAmendReason(e.target.value)}
            placeholder="e.g. Job site required additional material..."
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
          />
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={submitAmendment}
            disabled={loading}
            className="bg-amber-600 text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-amber-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Sending…" : "Send Amendment Request"}
          </button>
          <button onClick={() => setStep("enter")} disabled={loading} className="text-xs text-gray-400 hover:text-gray-600 px-2 disabled:opacity-50">
            ← Back
          </button>
        </div>
      </div>
    );
  }

  // ── amendment pending ─────────────────────────────────────────────────────
  if (step === "amendment-pending") {
    const haulerDone = amendment?.haulerApproved !== null && amendment?.haulerApproved !== undefined;
    const pitDone    = amendment?.pitOwnerApproved !== null && amendment?.pitOwnerApproved !== undefined;
    return (
      <div className="space-y-3">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
            <p className="font-semibold text-amber-800 text-sm">Amendment Pending Approval</p>
          </div>
          <p className="text-xs text-amber-700">
            Requesting {amendment?.requestedLoads ?? actualLoads} loads (up from {estimatedLoads}).
            Waiting for approval before additional loads can be charged.
          </p>
          <div className="flex gap-4 text-xs mt-1">
            <span className={haulerDone ? (amendment?.haulerApproved ? "text-green-700" : "text-red-600") : "text-gray-400"}>
              Hauler: {haulerDone ? (amendment?.haulerApproved ? "✓ Approved" : "✗ Denied") : "Awaiting…"}
            </span>
            {(amendment?.pitOwnerApproved !== true || !haulerDone) && (
              <span className={pitDone ? (amendment?.pitOwnerApproved ? "text-green-700" : "text-red-600") : "text-gray-400"}>
                Pit Owner: {pitDone ? (amendment?.pitOwnerApproved ? "✓ Approved" : "✗ Denied") : "Awaiting…"}
              </span>
            )}
          </div>
        </div>
        <button onClick={() => router.refresh()} className="text-xs text-gray-400 hover:text-gray-600">
          Refresh status
        </button>
      </div>
    );
  }

  // ── amendment approved — ready to complete with new load count ────────────
  if (step === "amendment-approved") {
    return (
      <div className="space-y-3">
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-xs text-green-700">
          ✓ Extra loads approved. You can now confirm completion for {actualLoads} loads ({fmt(actualTotal)}).
        </div>
        <button
          onClick={() => setStep("confirm")}
          className="bg-green-600 text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-green-700 transition-colors"
        >
          Review & Confirm →
        </button>
      </div>
    );
  }

  // ── confirm ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm space-y-2">
        <p className="font-semibold text-amber-800">Confirm completion</p>
        <div className="flex justify-between text-amber-700">
          <span>Actual loads</span>
          <span className="font-bold">{actualLoads}</span>
        </div>
        {actualLoads !== estimatedLoads && (
          <div className="flex justify-between text-amber-600 text-xs">
            <span>Original estimate</span>
            <span className="line-through">{estimatedLoads} loads</span>
          </div>
        )}
        <div className="flex justify-between text-amber-700 border-t border-amber-200 pt-2">
          <span>Final charge</span>
          <span className="font-black text-base">{fmt(actualTotal)}</span>
        </div>
        {delta < 0 && (
          <p className="text-xs text-green-700">Saving {fmt(Math.abs(delta))} vs original estimate.</p>
        )}
      </div>
      <p className="text-xs text-gray-400 italic">
        By confirming, you agree to the final charge based on actual loads.
        {within24h ? " A small processing fee may apply for changes within 24 hours." : ""}
        Disputes can be submitted within 48 hours.
      </p>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={complete}
          disabled={loading}
          className="bg-green-600 text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "Processing…" : `Confirm — Pay ${fmt(actualTotal)}`}
        </button>
        <button onClick={() => setStep("enter")} disabled={loading} className="text-xs text-gray-400 hover:text-gray-600 px-2 disabled:opacity-50">
          ← Edit loads
        </button>
      </div>
    </div>
  );
}
