"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { PitType } from "@/types";

interface PitFormData {
  name: string;
  address: string;
  state: string;
  latitude: string;
  longitude: string;
  pitType: PitType;
  accepting: boolean;
  dumpRateDollars: string;
  borrowRateDollars: string;
  hasTopsoil: boolean;
  topsoilRateDollars: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  notes: string;
}

interface Props {
  initialData?: Partial<PitFormData>;
  pitId?: string;
  redirectTo?: string;
}

const DEFAULT: PitFormData = {
  name: "",
  address: "",
  state: "GA",
  latitude: "",
  longitude: "",
  pitType: "WASTE_BORROW",
  accepting: true,
  dumpRateDollars: "",
  borrowRateDollars: "",
  hasTopsoil: false,
  topsoilRateDollars: "",
  contactName: "",
  contactPhone: "",
  contactEmail: "",
  notes: "",
};

export function PitForm({ initialData, pitId, redirectTo = "/dashboard/pit-owner/pits" }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<PitFormData>({ ...DEFAULT, ...initialData });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function set(field: keyof PitFormData, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const lat = parseFloat(form.latitude);
    const lng = parseFloat(form.longitude);

    if (!isFinite(lat) || !isFinite(lng)) {
      setError("Please enter valid latitude and longitude coordinates.");
      setLoading(false);
      return;
    }

    const payload = {
      name: form.name,
      address: form.address || undefined,
      state: form.state,
      latitude: lat,
      longitude: lng,
      pitType: form.pitType,
      accepting: form.accepting,
      dumpRateCents: form.dumpRateDollars ? Math.round(parseFloat(form.dumpRateDollars) * 100) : undefined,
      borrowRateCents: form.borrowRateDollars ? Math.round(parseFloat(form.borrowRateDollars) * 100) : undefined,
      hasTopsoil: form.hasTopsoil,
      topsoilRateCents: form.topsoilRateDollars ? Math.round(parseFloat(form.topsoilRateDollars) * 100) : undefined,
      contactName: form.contactName || undefined,
      contactPhone: form.contactPhone || undefined,
      contactEmail: form.contactEmail || undefined,
      notes: form.notes || undefined,
    };

    const res = await fetch(pitId ? `/api/pits/${pitId}` : "/api/pits", {
      method: pitId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error?.message ?? data.error ?? "Save failed");
      setLoading(false);
      return;
    }

    router.push(redirectTo);
    router.refresh();
  }

  const inputClass = "w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>}

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className={labelClass}>Pit Name *</label>
          <input required value={form.name} onChange={(e) => set("name", e.target.value)} className={inputClass} placeholder="Smith Borrow Pit" />
        </div>

        <div className="sm:col-span-2">
          <label className={labelClass}>Address</label>
          <input value={form.address} onChange={(e) => set("address", e.target.value)} className={inputClass} placeholder="123 County Rd, City" />
        </div>

        <div>
          <label className={labelClass}>State</label>
          <select value={form.state} onChange={(e) => set("state", e.target.value)} className={inputClass}>
            <option value="GA">Georgia</option>
            <option value="AL">Alabama</option>
            <option value="FL">Florida</option>
            <option value="SC">South Carolina</option>
            <option value="TN">Tennessee</option>
            <option value="NC">North Carolina</option>
          </select>
        </div>

        <div>
          <label className={labelClass}>Pit Type *</label>
          <select required value={form.pitType} onChange={(e) => set("pitType", e.target.value as PitType)} className={inputClass}>
            <option value="WASTE_BORROW">Waste & Borrow</option>
            <option value="WASTE">Waste Only</option>
            <option value="BORROW">Borrow Only</option>
          </select>
        </div>

        <div>
          <label className={labelClass}>Latitude *</label>
          <input required value={form.latitude} onChange={(e) => set("latitude", e.target.value)} className={inputClass} placeholder="33.749" />
        </div>

        <div>
          <label className={labelClass}>Longitude *</label>
          <input required value={form.longitude} onChange={(e) => set("longitude", e.target.value)} className={inputClass} placeholder="-84.388" />
        </div>
      </div>

      {/* Rates */}
      <div className="border-t border-gray-100 pt-6">
        <h3 className="text-sm font-semibold text-gray-800 mb-4">Rates (per load)</h3>
        <div className="grid sm:grid-cols-3 gap-4">
          {(form.pitType === "WASTE" || form.pitType === "WASTE_BORROW") && (
            <div>
              <label className={labelClass}>Dump Rate ($)</label>
              <input type="number" step="0.01" min="0" value={form.dumpRateDollars} onChange={(e) => set("dumpRateDollars", e.target.value)} className={inputClass} placeholder="5.00" />
            </div>
          )}
          {(form.pitType === "BORROW" || form.pitType === "WASTE_BORROW") && (
            <div>
              <label className={labelClass}>Borrow Rate ($)</label>
              <input type="number" step="0.01" min="0" value={form.borrowRateDollars} onChange={(e) => set("borrowRateDollars", e.target.value)} className={inputClass} placeholder="8.00" />
            </div>
          )}
          <div>
            <label className={labelClass}>Has Topsoil Area?</label>
            <div className="flex items-center gap-3 mt-2">
              <input type="checkbox" id="topsoil" checked={form.hasTopsoil} onChange={(e) => set("hasTopsoil", e.target.checked)} className="w-4 h-4 accent-green-600" />
              <label htmlFor="topsoil" className="text-sm text-gray-600">Yes — clean topsoil stockpile</label>
            </div>
          </div>
          {form.hasTopsoil && (
            <div>
              <label className={labelClass}>Topsoil Rate ($)</label>
              <input type="number" step="0.01" min="0" value={form.topsoilRateDollars} onChange={(e) => set("topsoilRateDollars", e.target.value)} className={inputClass} placeholder="10.00" />
            </div>
          )}
        </div>
      </div>

      {/* Status */}
      <div className="flex items-center gap-3">
        <input type="checkbox" id="accepting" checked={form.accepting} onChange={(e) => set("accepting", e.target.checked)} className="w-4 h-4 accent-green-600" />
        <label htmlFor="accepting" className="text-sm font-medium text-gray-700">Open — currently accepting material (green pin on map)</label>
      </div>

      {/* Contact */}
      <div className="border-t border-gray-100 pt-6">
        <h3 className="text-sm font-semibold text-gray-800 mb-4">Contact Info (optional)</h3>
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Name</label>
            <input value={form.contactName} onChange={(e) => set("contactName", e.target.value)} className={inputClass} placeholder="John Smith" />
          </div>
          <div>
            <label className={labelClass}>Phone</label>
            <input value={form.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} className={inputClass} placeholder="(555) 555-5555" />
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input type="email" value={form.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} className={inputClass} placeholder="you@example.com" />
          </div>
        </div>
      </div>

      <div>
        <label className={labelClass}>Notes</label>
        <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3} className={inputClass} placeholder="Any additional info about this pit…" />
      </div>

      <div className="flex gap-4 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="bg-green-600 text-white px-8 py-3 rounded-xl font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "Saving…" : pitId ? "Save Changes" : "Add Pit"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-8 py-3 rounded-xl font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
