"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function AdminSettingsPage() {
  const [, setFeePercent] = useState<number>(8);
  const [inputVal, setInputVal] = useState("8");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then((d) => {
      setFeePercent(d.feePercent);
      setInputVal(String(d.feePercent));
    });
  }, []);

  async function save() {
    setSaving(true);
    setError("");
    setSaved(false);
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feePercent: parseFloat(inputVal) }),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setFeePercent(parseFloat(inputVal));
    } else {
      const d = await res.json();
      setError(d.error ?? "Save failed");
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard/admin" className="text-green-600 text-sm font-medium">← Admin</Link>
        <span className="font-bold text-green-700 text-lg">Got Dirt</span>
      </nav>

      <div className="max-w-lg mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">Platform Settings</h1>

        <div className="bg-white rounded-2xl border border-gray-200 p-8 space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Platform Fee (%)
            </label>
            <p className="text-xs text-gray-400 mb-3">
              This percentage is deducted from each transaction. The pit owner receives the remainder.
            </p>
            <div className="flex gap-3 items-center">
              <input
                type="number"
                min="0"
                max="50"
                step="0.5"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                className="w-28 border border-gray-300 rounded-xl px-4 py-2 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <span className="text-gray-600 text-lg">%</span>
            </div>
          </div>

          {/* Example breakdown */}
          <div className="bg-gray-50 rounded-xl p-4 text-sm">
            <p className="font-semibold text-gray-700 mb-2">Example (100 per load × 2 loads = $200 total):</p>
            <div className="space-y-1 text-gray-600">
              <div className="flex justify-between">
                <span>Platform keeps ({parseFloat(inputVal) || 0}%)</span>
                <span className="font-semibold text-orange-700">${(200 * (parseFloat(inputVal) || 0) / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Pit owner receives</span>
                <span className="font-semibold text-green-700">${(200 - 200 * (parseFloat(inputVal) || 0) / 100).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>}
          {saved && <div className="bg-green-50 text-green-700 text-sm px-4 py-3 rounded-xl">Settings saved successfully.</div>}

          <button
            onClick={save}
            disabled={saving}
            className="bg-green-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving…" : "Save Settings"}
          </button>
        </div>
      </div>
    </div>
  );
}
