"use client";

import { useState } from "react";

interface Initial {
  companyName:     string;
  bio:             string;
  website:         string;
  profilePublic:   boolean;
  haulRateDollars: string;
}

export default function CarrierProfileForm({ initial }: { initial: Initial }) {
  const [companyName,   setCompanyName]   = useState(initial.companyName);
  const [bio,           setBio]           = useState(initial.bio);
  const [website,       setWebsite]       = useState(initial.website);
  const [profilePublic, setProfilePublic] = useState(initial.profilePublic);
  const [haulRate,      setHaulRate]      = useState(initial.haulRateDollars);
  const [saving,        setSaving]        = useState(false);
  const [saved,         setSaved]         = useState(false);
  const [error,         setError]         = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const res = await fetch("/api/carrier/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName:   companyName || undefined,
          bio:           bio || undefined,
          website:       website || undefined,
          profilePublic,
          haulRateCents: haulRate ? Math.round(parseFloat(haulRate) * 100) : undefined,
        }),
      });
      if (!res.ok) throw new Error();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const inputClass = "w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500";
  const labelClass = "text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      <div>
        <label className={labelClass}>Company Name *</label>
        <input type="text" required value={companyName} onChange={(e) => setCompanyName(e.target.value)}
          placeholder="ABC Trucking LLC" className={inputClass} />
      </div>

      <div>
        <label className={labelClass}>About Your Company</label>
        <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} maxLength={500}
          placeholder="Service area, fleet size, specialties…" className={`${inputClass} resize-none`} />
        <p className="text-xs text-gray-400 mt-1">{bio.length}/500</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Website</label>
          <input type="url" value={website} onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://abctrucking.com" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Haul Rate ($ per load)</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
            <input type="number" step="0.01" min="0" value={haulRate} onChange={(e) => setHaulRate(e.target.value)}
              placeholder="0.00"
              className="w-full border border-gray-200 rounded-xl pl-8 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
          </div>
          <p className="text-xs text-gray-400 mt-1">Visible to Direct Buyers only — never shown to independent drivers.</p>
        </div>
      </div>

      {/* Public toggle */}
      <div className="flex items-center justify-between py-3 border-t border-gray-100">
        <div>
          <p className="text-sm font-semibold text-gray-700">Public Profile</p>
          <p className="text-xs text-gray-400">Show company profile and terminal locations to buyers</p>
        </div>
        <button type="button" onClick={() => setProfilePublic((v) => !v)}
          className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${profilePublic ? "bg-amber-500" : "bg-gray-200"}`}>
          <span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform duration-200 ${profilePublic ? "translate-x-5" : "translate-x-0"}`} />
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving}
          className="bg-amber-600 text-white px-6 py-2.5 rounded-xl font-semibold text-sm hover:bg-amber-700 disabled:opacity-50 transition-colors">
          {saving ? "Saving…" : "Save Profile"}
        </button>
        {saved && <span className="text-sm text-green-600 font-medium">✓ Saved</span>}
      </div>
    </form>
  );
}
