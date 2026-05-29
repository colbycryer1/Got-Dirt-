"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Preview {
  loadCount:  number;
  grossCents: number;
  ratePerLoad: number;
  feePercent: number;
}

function fmt(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function ChargeOrderButton({ orderId, loadCount }: { orderId: string; loadCount: number }) {
  const router = useRouter();
  const [preview,    setPreview]    = useState<Preview | null>(null);
  const [loading,    setLoading]    = useState(false);
  const [charging,   setCharging]   = useState(false);
  const [error,      setError]      = useState("");
  const [done,       setDone]       = useState(false);

  async function fetchPreview() {
    setLoading(true);
    setError("");
    const res  = await fetch(`/api/orders/${orderId}/charge`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setError(data.error ?? "Could not load charge details"); }
    else { setPreview(data); }
    setLoading(false);
  }

  async function charge() {
    setCharging(true);
    setError("");
    const res  = await fetch(`/api/orders/${orderId}/charge`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setDone(true);
      router.refresh();
    } else {
      setError(data.error ?? "Charge failed");
      setCharging(false);
    }
  }

  if (done) {
    return <span className="text-xs text-green-600 font-semibold">✓ Charged</span>;
  }

  if (preview) {
    return (
      <div className="space-y-2 w-full">
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">{preview.loadCount} loads × {fmt(preview.ratePerLoad)}</span>
            <span className="font-semibold text-gray-900">{fmt(preview.grossCents)}</span>
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-0.5">
            <span>Platform fee ({preview.feePercent}%)</span>
            <span>−{fmt(Math.round(preview.grossCents * preview.feePercent / 100))}</span>
          </div>
        </div>
        {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={charge}
            disabled={charging}
            className="text-xs bg-amber-600 text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-amber-700 disabled:opacity-50 transition-colors"
          >
            {charging ? "Charging…" : `Confirm — Charge ${fmt(preview.grossCents)}`}
          </button>
          <button
            onClick={() => { setPreview(null); setError(""); }}
            disabled={charging}
            className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1.5"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={fetchPreview}
      disabled={loading}
      className="text-xs bg-amber-100 border border-amber-400 text-amber-800 px-3 py-1.5 rounded-lg font-semibold hover:bg-amber-200 disabled:opacity-50 transition-colors"
    >
      {loading ? "Loading…" : `⚡ Charge for ${loadCount} Load${loadCount !== 1 ? "s" : ""}`}
    </button>
  );
}
