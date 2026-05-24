"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { PitType, MATERIAL_TYPES_BASE, MATERIAL_TYPES_AGGREGATE } from "@/types";

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
  operatorProvided: boolean;
  equipmentProvided: boolean;
  equipmentNotes: string;
  hoursOpen: string;
  hoursClose: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  notes: string;
  materialTypes: string[];
  geofenceRadiusMeters: string;
}

interface Props {
  initialData?: Partial<PitFormData>;
  pitId?: string;
  redirectTo?: string;
  isAdmin?: boolean;
}

const DEFAULT: PitFormData = {
  name: "",
  address: "",
  state: "GA",
  latitude: "",
  longitude: "",
  pitType: "PRIVATE_BORROW_PIT",
  accepting: true,
  dumpRateDollars: "",
  borrowRateDollars: "",
  hasTopsoil: false,
  topsoilRateDollars: "",
  operatorProvided: false,
  equipmentProvided: false,
  equipmentNotes: "",
  hoursOpen: "",
  hoursClose: "",
  contactName: "",
  contactPhone: "",
  contactEmail: "",
  notes: "",
  materialTypes: [],
  geofenceRadiusMeters: "200",
};

export function PitForm({ initialData, pitId, redirectTo = "/dashboard/pit-owner/pits", isAdmin = false }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<PitFormData>({ ...DEFAULT, ...initialData });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function set(field: keyof PitFormData, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function toggleMaterial(material: string) {
    setForm((prev) => ({
      ...prev,
      materialTypes: prev.materialTypes.includes(material)
        ? prev.materialTypes.filter((m) => m !== material)
        : [...prev.materialTypes, material],
    }));
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
      operatorProvided:  form.operatorProvided,
      equipmentProvided: form.equipmentProvided,
      equipmentNotes:    form.equipmentNotes || undefined,
      hoursOpen:         form.hoursOpen || undefined,
      hoursClose:        form.hoursClose || undefined,
      contactName:  form.contactName || undefined,
      contactPhone: form.contactPhone || undefined,
      contactEmail: form.contactEmail || undefined,
      notes:        form.notes || undefined,
      materialTypes: form.materialTypes,
      ...(isAdmin && form.geofenceRadiusMeters
        ? { geofenceRadiusMeters: parseInt(form.geofenceRadiusMeters) }
        : {}),
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

  const inputClass = "w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500";
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
            <option value="PRIVATE_BORROW_PIT">Private Borrow Pit</option>
            <option value="QUARRY">Quarry</option>
            <option value="WASTE_BORROW">Waste &amp; Borrow (legacy)</option>
            <option value="WASTE">Waste Only (legacy)</option>
            <option value="BORROW">Borrow Only (legacy)</option>
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
          {(form.pitType === "BORROW" || form.pitType === "WASTE_BORROW" || form.pitType === "PRIVATE_BORROW_PIT" || form.pitType === "QUARRY") && (
            <div>
              <label className={labelClass}>Borrow Rate ($)</label>
              <input type="number" step="0.01" min="0" value={form.borrowRateDollars} onChange={(e) => set("borrowRateDollars", e.target.value)} className={inputClass} placeholder="8.00" />
            </div>
          )}
          <div>
            <label className={labelClass}>Has Topsoil Area?</label>
            <div className="flex items-center gap-3 mt-2">
              <input type="checkbox" id="topsoil" checked={form.hasTopsoil} onChange={(e) => set("hasTopsoil", e.target.checked)} className="w-4 h-4 accent-amber-600" />
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
        <input type="checkbox" id="accepting" checked={form.accepting} onChange={(e) => set("accepting", e.target.checked)} className="w-4 h-4 accent-amber-600" />
        <label htmlFor="accepting" className="text-sm font-medium text-gray-700">Open — currently accepting material (green pin on map)</label>
      </div>

      {/* Operator & Equipment */}
      <div className="border-t border-gray-100 pt-6">
        <h3 className="text-sm font-semibold text-gray-800 mb-4">Operator & Equipment</h3>
        <div className="space-y-3">
          <label className="flex items-center gap-3 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={form.operatorProvided} onChange={(e) => set("operatorProvided", e.target.checked)} className="w-4 h-4 accent-amber-600" />
            <span><span className="font-medium">Operator Provided</span> — onsite pit operator included</span>
          </label>
          <label className="flex items-center gap-3 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={form.equipmentProvided} onChange={(e) => set("equipmentProvided", e.target.checked)} className="w-4 h-4 accent-amber-600" />
            <span><span className="font-medium">Equipment Provided</span> — loading equipment on site</span>
          </label>
          {form.equipmentProvided && (
            <div>
              <label className={labelClass}>Equipment Notes</label>
              <input
                value={form.equipmentNotes}
                onChange={(e) => set("equipmentNotes", e.target.value)}
                className={inputClass}
                placeholder="e.g. Excavator + D6 dozer on site"
              />
            </div>
          )}
        </div>
      </div>

      {/* Operating Hours */}
      <div className="border-t border-gray-100 pt-6">
        <h3 className="text-sm font-semibold text-gray-800 mb-4">Operating Hours (optional)</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Open</label>
            <input type="time" value={form.hoursOpen} onChange={(e) => set("hoursOpen", e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Close</label>
            <input type="time" value={form.hoursClose} onChange={(e) => set("hoursClose", e.target.value)} className={inputClass} />
          </div>
        </div>
      </div>

      {/* Material Types */}
      <div className="border-t border-gray-100 pt-6">
        <h3 className="text-sm font-semibold text-gray-800 mb-1">Material Types</h3>
        <p className="text-xs text-gray-400 mb-3">Check all materials available at this pit</p>
        <div className="grid sm:grid-cols-2 gap-y-2 gap-x-4 mb-4">
          {MATERIAL_TYPES_BASE.map((m) => (
            <label key={m} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={form.materialTypes.includes(m)} onChange={() => toggleMaterial(m)} className="w-4 h-4 accent-amber-600" />
              {m}
            </label>
          ))}
        </div>
        <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Aggregate</p>
        <div className="grid sm:grid-cols-2 gap-y-2 gap-x-4 pl-2">
          {MATERIAL_TYPES_AGGREGATE.map((m) => (
            <label key={m} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={form.materialTypes.includes(m)} onChange={() => toggleMaterial(m)} className="w-4 h-4 accent-amber-600" />
              {m}
            </label>
          ))}
        </div>
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

      {isAdmin && (
        <div className="border-t border-gray-100 pt-6">
          <h3 className="text-sm font-semibold text-gray-800 mb-1">Admin Settings</h3>
          <p className="text-xs text-gray-400 mb-3">These fields are only visible to admins</p>
          <div className="max-w-xs">
            <label className={labelClass}>Geofence Radius (meters)</label>
            <input
              type="number"
              min="50"
              max="2000"
              step="10"
              value={form.geofenceRadiusMeters}
              onChange={(e) => set("geofenceRadiusMeters", e.target.value)}
              className={inputClass}
              placeholder="200"
            />
            <p className="text-xs text-gray-400 mt-1">Driver must be within this radius to log a GPS load</p>
          </div>
        </div>
      )}

      <div>
        <label className={labelClass}>Notes</label>
        <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3} className={inputClass} placeholder="Any additional info about this pit…" />
      </div>

      <div className="flex gap-4 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="bg-amber-600 text-white px-8 py-3 rounded-xl font-semibold hover:bg-amber-700 disabled:opacity-50 transition-colors"
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
