"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Buyer = { id: string; email: string; name: string | null; company: string | null };

export default function NetTermsAssignForm({ buyers }: { buyers: Buyer[] }) {
  const router = useRouter();
  const [buyerUserId, setBuyerUserId] = useState("");
  const [termsDays, setTermsDays] = useState(30);
  const [creditLimit, setCreditLimit] = useState("");
  const [downPaymentPct, setDownPaymentPct] = useState(0);
  const [billingPeriodDays, setBillingPeriodDays] = useState(30);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!buyerUserId) { setError("Select a buyer"); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/net-terms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyerUserId,
          termsDays,
          creditLimitCents: creditLimit ? Math.round(parseFloat(creditLimit) * 100) : null,
          downPaymentPct,
          billingPeriodDays,
          notes: notes || undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="px-4 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800 font-medium text-sm"
        >
          + Assign Net Terms
        </button>
      )}

      {open && (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <h2 className="font-semibold text-gray-800">Assign Net Terms to Buyer</h2>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Buyer *</label>
            <select
              value={buyerUserId}
              onChange={(e) => setBuyerUserId(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              required
            >
              <option value="">— select buyer —</option>
              {buyers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.company ?? b.name ?? b.email} ({b.email})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Terms (days)</label>
              <select
                value={termsDays}
                onChange={(e) => setTermsDays(Number(e.target.value))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                {[15, 30, 45, 60, 90].map((d) => (
                  <option key={d} value={d}>NET {d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Credit Limit ($, blank = none)</label>
              <input
                type="number"
                min="0"
                step="100"
                value={creditLimit}
                onChange={(e) => setCreditLimit(e.target.value)}
                placeholder="No limit"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Down payment %</label>
              <input
                type="number"
                min="0"
                max="100"
                step="5"
                value={downPaymentPct}
                onChange={(e) => setDownPaymentPct(Number(e.target.value))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Billing period (days)</label>
              <select
                value={billingPeriodDays}
                onChange={(e) => setBillingPeriodDays(Number(e.target.value))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                {[7, 14, 30, 60].map((d) => (
                  <option key={d} value={d}>{d} days</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              placeholder="Internal notes..."
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800 font-medium text-sm disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save Terms"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
