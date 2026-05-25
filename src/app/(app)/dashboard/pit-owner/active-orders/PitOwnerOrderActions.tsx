"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  orderId: string;
  pitId:   string;
}

export default function PitOwnerOrderActions({ orderId }: Props) {
  const router = useRouter();

  const [loading,    setLoading]    = useState(false);
  const [done,       setDone]       = useState<"accepted" | "denied" | null>(null);
  const [error,      setError]      = useState<string | null>(null);
  const [showNotes,  setShowNotes]  = useState(false);
  const [denyNotes,  setDenyNotes]  = useState("");

  async function respond(approved: boolean, notes?: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/haul-orders/${orderId}/pit-owner-respond`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ approved, notes }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Something went wrong");
        return;
      }
      setDone(approved ? "accepted" : "denied");
      router.refresh();
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  if (done === "accepted") {
    return (
      <span className="inline-flex items-center gap-1 text-sm font-semibold text-green-700 bg-green-100 px-3 py-1 rounded-full">
        Accepted ✓
      </span>
    );
  }

  if (done === "denied") {
    return (
      <span className="inline-flex items-center gap-1 text-sm font-semibold text-red-700 bg-red-100 px-3 py-1 rounded-full">
        Denied ✗
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <p className="text-xs text-red-600 font-medium">{error}</p>
      )}

      {showNotes ? (
        <div className="flex flex-col gap-2">
          <input
            type="text"
            placeholder="Optional reason for denial"
            value={denyNotes}
            onChange={(e) => setDenyNotes(e.target.value)}
            className="border border-red-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
          />
          <div className="flex gap-2">
            <button
              onClick={() => respond(false, denyNotes || undefined)}
              disabled={loading}
              className="flex-1 py-1.5 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {loading ? "Denying…" : "Confirm Deny"}
            </button>
            <button
              onClick={() => { setShowNotes(false); setDenyNotes(""); }}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg text-sm font-semibold border border-gray-200 text-gray-600 hover:border-gray-400 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={() => respond(true)}
            disabled={loading}
            className="flex-1 py-1.5 rounded-lg text-sm font-semibold bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Saving…" : "Accept"}
          </button>
          <button
            onClick={() => setShowNotes(true)}
            disabled={loading}
            className="flex-1 py-1.5 rounded-lg text-sm font-semibold border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
          >
            Deny
          </button>
        </div>
      )}
    </div>
  );
}
