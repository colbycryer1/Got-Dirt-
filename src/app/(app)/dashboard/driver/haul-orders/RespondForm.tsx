"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RespondForm({ orderId }: { orderId: string }) {
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState("");
  const router = useRouter();

  async function respond(action: "CONFIRM" | "DENY") {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/haul-orders/${orderId}/respond`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to respond");
      }
      router.refresh();
      router.push("/dashboard/driver/haul-orders");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <div className="pt-3 border-t border-gray-100 space-y-2">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-3">
        <button
          onClick={() => respond("CONFIRM")}
          disabled={submitting}
          className="flex-1 bg-green-600 text-white py-2 rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-50"
        >
          {submitting ? "Confirming…" : "Confirm Order"}
        </button>
        <button
          onClick={() => respond("DENY")}
          disabled={submitting}
          className="flex-1 bg-white border border-gray-300 text-gray-600 py-2 rounded-xl text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
        >
          Deny
        </button>
      </div>
    </div>
  );
}
