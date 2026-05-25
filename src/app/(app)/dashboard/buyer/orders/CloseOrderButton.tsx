"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CloseOrderButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function closeOut() {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "COMPLETED" }),
    });
    if (res.ok) {
      router.refresh();
    } else {
      const d = await res.json();
      setError(d.error ?? "Failed to close order");
      setLoading(false);
      setConfirming(false);
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        {error && <span className="text-xs text-red-600">{error}</span>}
        <span className="text-xs text-gray-500">Mark as completed?</span>
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
