"use client";

import { useState, useEffect, useCallback } from "react";

interface UnclaimedPit {
  id: string;
  name: string;
  address: string | null;
  state: string;
  pitType: string;
  accepting: boolean;
  pitClaims: Array<{ id: string; status: string }>;
}

export default function ClaimPitList() {
  const [search, setSearch] = useState("");
  const [state, setState] = useState("");
  const [pits, setPits] = useState<UnclaimedPit[]>([]);
  const [loading, setLoading] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successId, setSuccessId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const fetchPits = useCallback(async () => {
    setLoading(true);
    const q = new URLSearchParams();
    if (search) q.set("search", search);
    if (state)  q.set("state", state);
    const res = await fetch(`/api/pit-claims?${q}`);
    const data = await res.json();
    setPits(data.pits ?? []);
    setLoading(false);
  }, [search, state]);

  useEffect(() => {
    const t = setTimeout(fetchPits, 300);
    return () => clearTimeout(t);
  }, [fetchPits]);

  async function submitClaim(pitId: string) {
    setSubmitting(true);
    setError("");
    const res = await fetch("/api/pit-claims", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pitId, message }),
    });
    if (res.ok) {
      setSuccessId(pitId);
      setClaimingId(null);
      setMessage("");
      fetchPits();
    } else {
      const d = await res.json();
      setError(d.error ?? "Failed to submit claim");
    }
    setSubmitting(false);
  }

  const GA_STATES = ["GA", "AL", "FL", "SC", "TN", "NC"];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by pit name or address…"
          className="flex-1 min-w-48 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
        <select
          value={state}
          onChange={(e) => setState(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All states</option>
          {GA_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {loading && (
        <div className="text-center py-8 text-gray-400 text-sm animate-pulse">Searching…</div>
      )}

      {!loading && pits.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p className="font-medium text-gray-600">No unclaimed pits found</p>
          <p className="text-sm mt-1">Try a different name or contact us and we&apos;ll add your pit.</p>
        </div>
      )}

      {!loading && pits.map((pit) => {
        const myClaim = pit.pitClaims[0];
        const alreadyClaimed = !!myClaim;
        const isSuccess = successId === pit.id;

        return (
          <div key={pit.id} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-semibold text-gray-900">{pit.name}</div>
                {pit.address && <div className="text-sm text-gray-500 mt-0.5">{pit.address}, {pit.state}</div>}
                <div className="flex gap-2 mt-2">
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                    {pit.pitType.replace("_", " / ")}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    pit.accepting ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                  }`}>
                    {pit.accepting ? "Accepting" : "Not accepting"}
                  </span>
                </div>
              </div>

              <div className="shrink-0">
                {isSuccess || (alreadyClaimed && myClaim.status === "PENDING") ? (
                  <span className="text-xs bg-amber-100 text-amber-700 px-3 py-1.5 rounded-full font-medium">
                    Claim pending review
                  </span>
                ) : alreadyClaimed && myClaim.status === "APPROVED" ? (
                  <span className="text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded-full font-medium">
                    ✓ Approved
                  </span>
                ) : alreadyClaimed && myClaim.status === "REJECTED" ? (
                  <span className="text-xs bg-red-100 text-red-700 px-3 py-1.5 rounded-full font-medium">
                    Rejected
                  </span>
                ) : (
                  <button
                    onClick={() => { setClaimingId(pit.id); setError(""); }}
                    className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm font-medium"
                  >
                    Claim This Pit
                  </button>
                )}
              </div>
            </div>

            {/* Claim form */}
            {claimingId === pit.id && (
              <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                <label className="block text-sm font-medium text-gray-700">
                  Tell us how you can verify ownership <span className="text-gray-400 font-normal">(optional but speeds up review)</span>
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  placeholder="e.g. Contact number on file: (555) 123-4567. Pit located at mile marker 12 on Hwy 19. We've operated since 2018."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
                {error && <p className="text-red-600 text-sm">{error}</p>}
                <div className="flex gap-3">
                  <button
                    onClick={() => submitClaim(pit.id)}
                    disabled={submitting}
                    className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm font-medium disabled:opacity-50"
                  >
                    {submitting ? "Submitting…" : "Submit Claim"}
                  </button>
                  <button
                    onClick={() => { setClaimingId(null); setMessage(""); setError(""); }}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
