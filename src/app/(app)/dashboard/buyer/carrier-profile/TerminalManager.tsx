"use client";

import { useState } from "react";

interface Terminal {
  id:      string;
  name:    string;
  address: string;
  lat:     number;
  lng:     number;
}

interface Props {
  carrierId:        string | null;
  initialTerminals: Terminal[];
}

const empty = { name: "", address: "", lat: "", lng: "" };

export default function TerminalManager({ initialTerminals }: Props) {
  const [terminals, setTerminals] = useState<Terminal[]>(initialTerminals);
  const [form,      setForm]      = useState(empty);
  const [adding,    setAdding]    = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [deleting,  setDeleting]  = useState<string | null>(null);
  const [error,     setError]     = useState("");

  function set(k: keyof typeof empty, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  async function addTerminal(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/carrier/terminals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:    form.name,
          address: form.address || undefined,
          lat:     parseFloat(form.lat),
          lng:     parseFloat(form.lng),
        }),
      });
      if (!res.ok) throw new Error("Failed to add terminal");
      const { terminal } = await res.json();
      setTerminals((t) => [...t, terminal]);
      setForm(empty);
      setAdding(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to add terminal");
    } finally {
      setSaving(false);
    }
  }

  async function deleteTerminal(id: string) {
    setDeleting(id);
    try {
      await fetch(`/api/carrier/terminals/${id}`, { method: "DELETE" });
      setTerminals((t) => t.filter((x) => x.id !== id));
    } finally {
      setDeleting(null);
    }
  }

  const inputClass = "w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500";

  return (
    <div className="space-y-4">
      {terminals.length === 0 && !adding && (
        <p className="text-sm text-gray-400 py-4 text-center">No terminals added yet. Add your depot or yard locations below.</p>
      )}

      {/* Terminal list */}
      {terminals.map((t) => (
        <div key={t.id} className="flex items-center justify-between gap-4 py-3 border-b border-gray-100">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-800">{t.name}</p>
            {t.address && <p className="text-xs text-gray-500">{t.address}</p>}
            <p className="text-xs text-gray-400">{t.lat.toFixed(5)}, {t.lng.toFixed(5)}</p>
          </div>
          <button
            onClick={() => deleteTerminal(t.id)}
            disabled={deleting === t.id}
            className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
          >
            {deleting === t.id ? "Removing…" : "Remove"}
          </button>
        </div>
      ))}

      {/* Add form */}
      {adding ? (
        <form onSubmit={addTerminal} className="space-y-3 pt-2">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Terminal Name *</label>
              <input required value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Main Yard" className={inputClass} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Address</label>
              <input value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="123 Main St, Atlanta, GA" className={inputClass} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Latitude *</label>
              <input required type="number" step="any" value={form.lat} onChange={(e) => set("lat", e.target.value)} placeholder="33.749" className={inputClass} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Longitude *</label>
              <input required type="number" step="any" value={form.lng} onChange={(e) => set("lng", e.target.value)} placeholder="-84.388" className={inputClass} />
            </div>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-3">
            <button type="submit" disabled={saving}
              className="bg-amber-600 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-amber-700 disabled:opacity-50">
              {saving ? "Saving…" : "Add Terminal"}
            </button>
            <button type="button" onClick={() => { setAdding(false); setForm(empty); setError(""); }}
              className="text-sm text-gray-500 hover:text-gray-700">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button onClick={() => setAdding(true)}
          className="text-sm text-amber-600 hover:underline font-medium">
          + Add Terminal Location
        </button>
      )}
    </div>
  );
}
