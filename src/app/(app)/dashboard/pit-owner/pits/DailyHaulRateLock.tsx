"use client";

import { useState } from "react";

interface Props {
  pitId:             string;
  currentRateCents:  number | null;
  lockedAt:          string | null; // ISO string or null
}

function isLockedToday(lockedAt: string | null): boolean {
  if (!lockedAt) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(lockedAt) >= today;
}

export default function DailyHaulRateLock({ pitId, currentRateCents, lockedAt }: Props) {
  const [open,       setOpen]       = useState(false);
  const [rateInput,  setRateInput]  = useState(
    currentRateCents && isLockedToday(lockedAt)
      ? (currentRateCents / 100).toFixed(2)
      : ""
  );
  const [saving,     setSaving]     = useState(false);
  const [locked,     setLocked]     = useState(isLockedToday(lockedAt));
  const [lockedRate, setLockedRate] = useState(
    isLockedToday(lockedAt) ? (currentRateCents ?? null) : null
  );
  const [error,      setError]      = useState("");

  async function save() {
    const cents = Math.round(parseFloat(rateInput) * 100);
    if (!cents || cents < 100) { setError("Enter a valid rate ($1.00 minimum)."); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/pits/${pitId}/daily-haul-rate`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ rateCents: cents }),
      });
      if (!res.ok) throw new Error("Failed to lock rate");
      setLocked(true);
      setLockedRate(cents);
      setOpen(false);
    } catch {
      setError("Failed to save rate. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function clear() {
    setSaving(true);
    try {
      const res = await fetch(`/api/pits/${pitId}/daily-haul-rate`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ clear: true }),
      });
      if (!res.ok) throw new Error("Failed to clear rate");
      setLocked(false);
      setLockedRate(null);
      setRateInput("");
      setOpen(false);
    } catch {
      setError("Failed to clear rate.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      {locked && lockedRate ? (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-semibold text-green-700">
              Haul rate locked today — ${(lockedRate / 100).toFixed(2)}/load
            </span>
            <span className="text-xs text-gray-400">(broadcast to all haulers)</span>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setOpen(!open)}
              className="text-xs text-amber-600 hover:text-amber-700 font-semibold">
              Update
            </button>
            <button onClick={clear} disabled={saving}
              className="text-xs text-gray-400 hover:text-red-600 font-semibold">
              Clear
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 text-xs font-semibold text-gray-500 hover:text-amber-700 transition-colors"
        >
          <span className="w-2 h-2 rounded-full bg-gray-300" />
          No haul rate locked today — tap to lock
        </button>
      )}

      {open && (
        <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
          <p className="text-xs text-amber-800 font-semibold">
            Lock Today&apos;s Haul Rate
          </p>
          <p className="text-xs text-amber-700">
            When locked, open broadcasts at this pit use your rate and go to <strong>all</strong> verified drivers and carriers. Required daily (unless a buyer agreement is in place).
          </p>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input
                type="number"
                min="1"
                step="0.01"
                value={rateInput}
                onChange={(e) => setRateInput(e.target.value)}
                placeholder="0.00"
                className="w-full border border-gray-200 rounded-xl pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <span className="text-xs text-gray-500">per load</span>
            <button
              onClick={save}
              disabled={saving}
              className="bg-amber-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-amber-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Lock Rate"}
            </button>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
