"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

interface Props {
  orderId:        string;
  estimatedLoads: number;
  haulRateCents:  number;
  createdAt:      string; // ISO string
}

type Step = "idle" | "enter" | "confirm";

export default function CompleteHaulButton({ orderId, estimatedLoads, haulRateCents, createdAt }: Props) {
  const router = useRouter();
  const [step,        setStep]        = useState<Step>("idle");
  const [actualLoads, setActualLoads] = useState(estimatedLoads);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");
  const [logCount,    setLogCount]    = useState<number | null>(null);
  const [logPitName,  setLogPitName]  = useState<string | null>(null);
  const fetchedRef = useRef(false);

  const fmt = (cents: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

  const hoursSincePlaced = (Date.now() - new Date(createdAt).getTime()) / 1000 / 3600;
  const within24h = hoursSincePlaced < 24;

  // Pre-populate with pit operator's logged count when buyer opens the form
  useEffect(() => {
    if (step !== "enter" || fetchedRef.current) return;
    fetchedRef.current = true;
    fetch(`/api/haul-orders/${orderId}/load-log-count`)
      .then((r) => r.json())
      .then((data) => {
        if (typeof data.count === "number") {
          setLogCount(data.count);
          setLogPitName(data.pitName ?? null);
          if (data.count > 0) setActualLoads(data.count);
        }
      })
      .catch(() => {/* ignore */});
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
        {/* Pit operator count note */}
        {logCount !== null && (
          <div className={`text-xs px-3 py-2 rounded-lg ${logCount > 0 ? "bg-blue-50 text-blue-700" : "bg-gray-50 text-gray-500"}`}>
            {logCount > 0
              ? `Pit operator logged ${logCount} load${logCount !== 1 ? "s" : ""}${logPitName ? ` at ${logPitName}` : ""}.`
              : `No loads logged yet by the pit operator${logPitName ? ` at ${logPitName}` : ""}.`}
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

        {/* Cost preview */}
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
              <span>{delta > 0 ? "Extra charge" : "Savings"}</span>
              <span>{delta > 0 ? "+" : ""}{fmt(Math.abs(delta))}</span>
            </div>
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
            onClick={() => setStep("confirm")}
            className="bg-green-600 text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-green-700 transition-colors"
          >
            Review & Confirm →
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
        {delta > 0 && (
          <p className="text-xs text-amber-600">+{fmt(delta)} above the original estimate.</p>
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

