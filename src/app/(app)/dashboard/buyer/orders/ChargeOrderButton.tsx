"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ChargeOrderButton({ orderId, loadCount }: { orderId: string; loadCount: number }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");
  const [done,       setDone]       = useState(false);

  async function charge() {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/orders/${orderId}/charge`, { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      setDone(true);
      router.refresh();
    } else {
      setError(data.error ?? "Charge failed");
      setLoading(false);
      setConfirming(false);
    }
  }

  if (done) {
    return <span className="text-xs text-green-600 font-semibold">✓ Charged</span>;
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        {error && <span className="text-xs text-red-600">{error}</span>}
        <span className="text-xs text-gray-500">Charge card for {loadCount} load{loadCount !== 1 ? "s" : ""}?</span>
        <button
          onClick={charge}
          disabled={loading}
          className="text-xs bg-amber-600 text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-amber-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "Charging…" : "Yes, Charge Now"}
        </button>
        <button
          onClick={() => { setConfirming(false); setError(""); }}
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
      className="text-xs bg-amber-100 border border-amber-400 text-amber-800 px-3 py-1.5 rounded-lg font-semibold hover:bg-amber-200 transition-colors"
    >
      ⚡ Charge for Loads
    </button>
  );
}
