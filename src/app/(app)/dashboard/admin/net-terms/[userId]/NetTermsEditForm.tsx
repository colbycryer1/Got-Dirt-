"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Account = {
  buyerUserId: string;
  termsDays: number;
  creditLimitCents: number | null;
  downPaymentPct: number;
  billingPeriodDays: number;
  notes: string | null;
};

export default function NetTermsEditForm({ account }: { account: Account }) {
  const router = useRouter();
  const [termsDays, setTermsDays] = useState(account.termsDays);
  const [creditLimit, setCreditLimit] = useState(
    account.creditLimitCents ? String(account.creditLimitCents / 100) : ""
  );
  const [downPaymentPct, setDownPaymentPct] = useState(account.downPaymentPct);
  const [billingPeriodDays, setBillingPeriodDays] = useState(account.billingPeriodDays);
  const [notes, setNotes] = useState(account.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess(false);
    try {
      const res = await fetch(`/api/admin/net-terms/${account.buyerUserId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          termsDays,
          creditLimitCents: creditLimit ? Math.round(parseFloat(creditLimit) * 100) : null,
          downPaymentPct,
          billingPeriodDays,
          notes: notes || undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setSuccess(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Remove net terms from this buyer? This cannot be undone.")) return;
    const res = await fetch(`/api/admin/net-terms/${account.buyerUserId}`, { method: "DELETE" });
    if (res.ok) router.push("/dashboard/admin/net-terms");
  }

  return (
    <form onSubmit={handleSave} className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
      <h2 className="font-semibold text-gray-800">Edit Terms</h2>

      {error && <p className="text-red-600 text-sm">{error}</p>}
      {success && <p className="text-green-600 text-sm">Saved successfully.</p>}

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
        />
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800 font-medium text-sm disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
        <button
          type="button"
          onClick={handleDelete}
          className="px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 font-medium text-sm"
        >
          Remove Terms
        </button>
      </div>
    </form>
  );
}
