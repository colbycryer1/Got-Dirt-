"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ClaimActions({ claimId }: { claimId: string }) {
  const router = useRouter();
  const [adminNotes, setAdminNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  async function act(action: "approve" | "reject") {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/pit-claims/${claimId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, adminNotes: adminNotes || undefined }),
    });
    if (res.ok) {
      router.refresh();
    } else {
      const d = await res.json();
      setError(d.error ?? "Failed");
    }
    setLoading(false);
  }

  return (
    <div className="space-y-2">
      {!open && (
        <div className="flex gap-2">
          <button
            onClick={() => act("approve")}
            disabled={loading}
            className="px-4 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800 text-sm font-medium disabled:opacity-50"
          >
            ✓ Approve
          </button>
          <button
            onClick={() => setOpen(true)}
            disabled={loading}
            className="px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 text-sm font-medium disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      )}

      {open && (
        <div className="space-y-2">
          <textarea
            value={adminNotes}
            onChange={(e) => setAdminNotes(e.target.value)}
            rows={2}
            placeholder="Reason for rejection (shown to claimant)…"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button
              onClick={() => act("reject")}
              disabled={loading}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium disabled:opacity-50"
            >
              {loading ? "Rejecting…" : "Confirm Reject"}
            </button>
            <button onClick={() => setOpen(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-red-600 text-sm">{error}</p>}
    </div>
  );
}
