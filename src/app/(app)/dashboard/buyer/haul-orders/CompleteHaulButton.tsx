"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CompleteHaulButton({ orderId }: { orderId: string }) {
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const router = useRouter();

  async function complete() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/haul-orders/${orderId}/complete`, { method: "PATCH" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to complete order");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to complete order");
      setLoading(false);
      setConfirmed(false);
    }
  }

  if (!confirmed) {
    return (
      <button
        onClick={() => setConfirmed(true)}
        className="text-sm font-semibold text-green-700 hover:text-green-800 transition-colors"
      >
        Mark as Completed →
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <p className="text-xs text-gray-500">This will capture the deposit payment. Confirm?</p>
      <button
        onClick={complete}
        disabled={loading}
        className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
      >
        {loading ? "Processing…" : "Yes, Complete"}
      </button>
      <button
        onClick={() => setConfirmed(false)}
        className="text-xs text-gray-400 hover:text-gray-600"
      >
        Cancel
      </button>
      {error && <p className="text-xs text-red-600 w-full">{error}</p>}
    </div>
  );
}
