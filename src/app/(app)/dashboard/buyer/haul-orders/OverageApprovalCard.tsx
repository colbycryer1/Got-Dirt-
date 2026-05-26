"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  orderId:      string;
  pitName:      string;
  orderedLoads: number;
  actualLoads:  number;
  overageLoads: number;
  rateCents:    number;        // per-load rate (haul + material combined)
  cobTimeStr:   string;        // e.g. "5:30 PM"
}

export default function OverageApprovalCard({
  orderId, pitName, orderedLoads, actualLoads, overageLoads, rateCents, cobTimeStr,
}: Props) {
  const router   = useRouter();
  const [loading, setLoading] = useState<"approve" | "dispute" | null>(null);
  const [error,   setError]   = useState("");
  const [done,    setDone]    = useState<"approved" | "disputed" | null>(null);

  const fmt = (cents: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

  const overageCents        = overageLoads * rateCents;
  const originalTotal       = orderedLoads * rateCents;
  const newTotal            = actualLoads  * rateCents;

  async function respond(approved: boolean) {
    const key = approved ? "approve" : "dispute";
    setLoading(key);
    setError("");
    try {
      const res = await fetch(`/api/haul-orders/${orderId}/overage`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ approved }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      setDone(approved ? "approved" : "disputed");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(null);
    }
  }

  if (done === "approved") {
    return (
      <div className="mt-3 bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800">
        ✓ Extra loads approved — you will be charged for all <strong>{actualLoads} loads</strong> ({fmt(newTotal)}) at close of business.
      </div>
    );
  }

  if (done === "disputed") {
    return (
      <div className="mt-3 bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-600">
        Dispute recorded — you will be charged for the original <strong>{orderedLoads} loads</strong> ({fmt(originalTotal)}) only. The {overageLoads} extra load{overageLoads !== 1 ? "s" : ""} will not be billed.
      </div>
    );
  }

  return (
    <div className="mt-3 bg-amber-50 border border-amber-300 rounded-xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start gap-2">
        <span className="text-amber-500 mt-0.5">⚠️</span>
        <div>
          <p className="font-bold text-amber-900 text-sm">Extra Loads — Your Approval Needed</p>
          <p className="text-xs text-amber-700 mt-0.5">
            Pit operator at <strong>{pitName}</strong> ended the session with more loads than ordered.
            Approve by <strong>{cobTimeStr}</strong> or the extra loads will be automatically waived.
          </p>
        </div>
      </div>

      {/* Load breakdown */}
      <div className="bg-white rounded-lg border border-amber-200 divide-y divide-amber-100 text-xs">
        <div className="flex justify-between px-4 py-2.5">
          <span className="text-gray-500">Original order</span>
          <span className="font-semibold text-gray-700">{orderedLoads} load{orderedLoads !== 1 ? "s" : ""} · {fmt(originalTotal)}</span>
        </div>
        <div className="flex justify-between px-4 py-2.5">
          <span className="text-gray-500">Pit operator count</span>
          <span className="font-semibold text-gray-700">{actualLoads} loads · {fmt(newTotal)}</span>
        </div>
        <div className="flex justify-between px-4 py-2.5 bg-amber-50">
          <span className="text-amber-700 font-semibold">Extra charge if approved</span>
          <span className="font-black text-amber-800">+{fmt(overageCents)}</span>
        </div>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => respond(true)}
          disabled={!!loading}
          className="flex-1 bg-green-600 text-white rounded-xl py-2.5 text-xs font-bold hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {loading === "approve" ? "Approving…" : `Approve ${overageLoads} Extra Load${overageLoads !== 1 ? "s" : ""} (+${fmt(overageCents)})`}
        </button>
        <button
          onClick={() => respond(false)}
          disabled={!!loading}
          className="flex-1 bg-white border border-gray-300 text-gray-700 rounded-xl py-2.5 text-xs font-semibold hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          {loading === "dispute" ? "Submitting…" : `Dispute — Charge Original ${orderedLoads} Loads Only`}
        </button>
      </div>
    </div>
  );
}
