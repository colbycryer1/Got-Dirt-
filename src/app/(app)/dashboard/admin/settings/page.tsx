"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function AdminSettingsPage() {
  const [pitFee,       setPitFee]       = useState("8");
  const [haulFee,      setHaulFee]      = useState("10");
  const [saving,       setSaving]       = useState(false);
  const [saved,        setSaved]        = useState(false);
  const [error,        setError]        = useState("");

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then((d: { feePercent: number; haulFeePercent: number }) => {
      setPitFee(String(d.feePercent));
      setHaulFee(String(d.haulFeePercent ?? 10));
    });
  }, []);

  async function save() {
    setSaving(true); setError(""); setSaved(false);
    const res = await fetch("/api/settings", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        feePercent:     parseFloat(pitFee),
        haulFeePercent: parseFloat(haulFee),
      }),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
    } else {
      const d = await res.json() as { error?: string };
      setError(d.error ?? "Save failed");
    }
  }

  const pitPct  = parseFloat(pitFee)  || 0;
  const haulPct = parseFloat(haulFee) || 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard/admin" className="text-amber-600 text-sm font-medium">← Admin</Link>
        <span className="font-black text-black text-lg">Got Dirt?</span>
      </nav>

      <div className="max-w-lg mx-auto px-6 py-10 space-y-8">
        <h1 className="text-2xl font-bold text-gray-900">Platform Settings</h1>

        {/* Pit transaction fee */}
        <div className="bg-white rounded-2xl border border-gray-200 p-8 space-y-5">
          <div>
            <h2 className="text-base font-bold text-gray-800 mb-0.5">Pit Transaction Fee</h2>
            <p className="text-xs text-gray-400">
              Deducted from each pit order settlement. Pit owner receives the remainder.
            </p>
          </div>
          <div className="flex gap-3 items-center">
            <input
              type="number" min="0" max="50" step="0.5"
              value={pitFee}
              onChange={(e) => setPitFee(e.target.value)}
              className="w-28 border border-gray-300 rounded-xl px-4 py-2 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <span className="text-gray-600 text-lg">%</span>
          </div>
          <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600 space-y-1">
            <p className="font-semibold text-gray-700 mb-1">Example — $200 order:</p>
            <div className="flex justify-between"><span>Platform keeps</span><span className="font-semibold text-orange-700">${(200 * pitPct / 100).toFixed(2)}</span></div>
            <div className="flex justify-between"><span>Pit owner receives</span><span className="font-semibold text-amber-700">${(200 - 200 * pitPct / 100).toFixed(2)}</span></div>
          </div>
        </div>

        {/* Haul order fee */}
        <div className="bg-white rounded-2xl border border-gray-200 p-8 space-y-5">
          <div>
            <h2 className="text-base font-bold text-gray-800 mb-0.5">Haul Order Fee</h2>
            <p className="text-xs text-gray-400">
              Applied to Independent Truck Driver and 3PL/Carrier haul orders. Driver/carrier receives the remainder.
            </p>
          </div>
          <div className="flex gap-3 items-center">
            <input
              type="number" min="0" max="50" step="0.5"
              value={haulFee}
              onChange={(e) => setHaulFee(e.target.value)}
              className="w-28 border border-gray-300 rounded-xl px-4 py-2 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <span className="text-gray-600 text-lg">%</span>
          </div>
          <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600 space-y-1">
            <p className="font-semibold text-gray-700 mb-1">Example — 4 loads @ $75/load ($300 total):</p>
            <div className="flex justify-between"><span>Platform keeps ({haulPct}%)</span><span className="font-semibold text-orange-700">${(300 * haulPct / 100).toFixed(2)}</span></div>
            <div className="flex justify-between"><span>Driver/carrier receives</span><span className="font-semibold text-amber-700">${(300 - 300 * haulPct / 100).toFixed(2)}</span></div>
          </div>
        </div>

        {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>}
        {saved && <div className="bg-amber-50 text-amber-700 text-sm px-4 py-3 rounded-xl">Settings saved successfully.</div>}

        <button
          onClick={save}
          disabled={saving}
          className="bg-amber-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-amber-700 disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving…" : "Save Settings"}
        </button>
      </div>
    </div>
  );
}
