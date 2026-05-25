"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ChargeResult {
  status: string;
  message?: string;
  loadCount?: number;
  grossCents?: number;
}

export default function CloseOrderButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");
  const [result,     setResult]     = useState<ChargeResult | null>(null);

  async function closeOut() {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/orders/${orderId}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ status: "COMPLETED" }),
    });
    const data = await res.json();
    if (res.ok) {
      setResult(data.charge);
      setConfirming(false);
      router.refresh();
    } else {
      setError(data.error ?? "Failed to close order");
      setLoading(false);
      setConfirming(false);
    }
  }

  // After close — show charge outcome
  if (result) {
    if (result.status === "charged") {
      return (
        <span className="text-xs text-green-600 font-semibold">
          ✓ Closed &amp; charged ${((result.grossCents ?? 0) / 100).toFixed(2)} for {result.loadCount} load{result.loadCount !== 1 ? "s" : ""}
        </span>
      );
    }
    if (result.status === "no_payment_method") {
      return (
        <span className="text-xs text-amber-700 font-semibold">
          ⚠ Closed — <a href="/dashboard/buyer/billing" className="underline">Add a card</a> to pay for uncharged loads
        </span>
      );
    }
    if (result.status === "zero_amount") {
      return (
        <span className="text-xs text-red-600 font-semibold">
          Closed — {result.message}
        </span>
      );
    }
    if (result.status === "charge_failed") {
      return (
        <span className="text-xs text-red-600 font-semibold">
          Closed but charge failed: {result.message}
        </span>
      );
    }
    return <span className="text-xs text-gray-500">Closed</span>;
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        {error && <span className="text-xs text-red-600">{error}</span>}
        <span className="text-xs text-gray-500">Close &amp; charge for any remaining loads?</span>
        <button
          onClick={closeOut}
          disabled={loading}
          className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "Closing…" : "Yes, Close Out"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          disabled={loading}
          className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1.5"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="text-xs border border-gray-300 text-gray-600 px-3 py-1.5 rounded-lg font-medium hover:border-green-500 hover:text-green-700 transition-colors"
    >
      Close Out Order
    </button>
  );
}
