"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  orderId:       string;
  status:        string;
  scheduledDate: string; // ISO string
  loads:         number;
  notes:         string | null;
  haulRateCents: number;
  isConfirmed:   boolean;
}

export default function EditHaulOrderForm({ orderId, status, scheduledDate, loads, notes, haulRateCents, isConfirmed }: Props) {
  const router = useRouter();

  const toLocal = (iso: string) => {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const [date,       setDate]       = useState(toLocal(scheduledDate));
  const [loadsVal,   setLoadsVal]   = useState(String(loads));
  const [notesVal,   setNotesVal]   = useState(notes ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState("");

  const loadsNum     = parseInt(loadsVal) || 0;
  const newTotal     = loadsNum * haulRateCents;
  const loadsChanged = loadsNum !== loads;
  const dateChanged  = new Date(date).toISOString() !== scheduledDate;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const body: Record<string, unknown> = { action: "edit" };
      if (!isConfirmed && loadsChanged) body.loads = loadsNum;
      if (!isConfirmed && dateChanged)  body.scheduledDate = new Date(date).toISOString();
      body.notes = notesVal;

      const res = await fetch(`/api/haul-orders/${orderId}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to update order");
      }
      router.push("/dashboard/buyer/haul-orders");
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Update failed.");
      setSubmitting(false);
    }
  }

  const inputClass = "w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500";
  const labelClass = "text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {isConfirmed && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          <strong>This order is already confirmed by your hauler.</strong> Only notes can be edited.
          To change the date or load count, submit an amendment request from the haul orders page.
        </div>
      )}

      {/* Date/time — disabled for confirmed */}
      <div>
        <label className={labelClass}>Date & Time {isConfirmed ? "(locked)" : "*"}</label>
        <input
          type="datetime-local"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          disabled={isConfirmed}
          className={`${inputClass} ${isConfirmed ? "opacity-50 cursor-not-allowed bg-gray-50" : ""}`}
        />
      </div>

      {/* Loads — disabled for confirmed */}
      <div>
        <label className={labelClass}>Number of Loads {isConfirmed ? "(locked)" : "*"}</label>
        <input
          type="number"
          min="1"
          value={loadsVal}
          onChange={(e) => setLoadsVal(e.target.value)}
          disabled={isConfirmed}
          className={`${inputClass} ${isConfirmed ? "opacity-50 cursor-not-allowed bg-gray-50" : ""}`}
        />
        {!isConfirmed && loadsChanged && loadsNum > 0 && (
          <p className="text-xs text-gray-500 mt-1">
            New estimated total: ${(newTotal / 100).toFixed(2)} ({loadsNum} load{loadsNum !== 1 ? "s" : ""} × ${(haulRateCents / 100).toFixed(2)})
          </p>
        )}
      </div>

      {/* Notes */}
      <div>
        <label className={labelClass}>Notes / Instructions</label>
        <textarea
          value={notesVal}
          onChange={(e) => setNotesVal(e.target.value)}
          rows={3}
          placeholder="Job site address, gate code, special instructions…"
          className={`${inputClass} resize-none`}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 py-3 rounded-xl bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 disabled:opacity-50"
        >
          {submitting ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </form>
  );
}
