"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  orderId:     string;
  amendmentId: string;
}

export default function PitOwnerAmendmentRespondForm({ orderId, amendmentId }: Props) {
  const router = useRouter();
  const [notes,   setNotes]   = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [done,    setDone]    = useState(false);

  async function respond(approved: boolean) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/haul-orders/${orderId}/amendments/${amendmentId}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ approved, notes: notes || undefined }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to respond");
      setDone(true);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <p className="text-xs text-green-700 font-semibold">Response submitted. Thank you!</p>
    );
  }

  return (
    <div className="space-y-2">
      <div>
        <label className="text-xs text-gray-500 block mb-1">Notes (optional)</label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add a note..."
          className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={() => respond(true)}
          disabled={loading}
          className="flex-1 bg-green-600 text-white py-2 rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "…" : "Approve Extra Loads"}
        </button>
        <button
          onClick={() => respond(false)}
          disabled={loading}
          className="flex-1 bg-white border border-gray-300 text-gray-600 py-2 rounded-xl text-sm font-semibold hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          {loading ? "…" : "Deny"}
        </button>
      </div>
    </div>
  );
}
