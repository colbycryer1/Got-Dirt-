"use client";

import { useState } from "react";

interface Props {
  initial: {
    name: string | null;
    email: string;
    company: string | null;
    phone: string | null;
    role: string;
    createdAt: string;
  };
}

export default function AccountForm({ initial }: Props) {
  const [name, setName]       = useState(initial.name ?? "");
  const [company, setCompany] = useState(initial.company ?? "");
  const [phone, setPhone]     = useState(initial.phone ?? "");
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [error, setError]     = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const res = await fetch("/api/users/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, company, phone }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Failed to save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const roleLabel: Record<string, string> = {
    BUYER:      "Direct Buyer",
    CARRIER:    "3PL / Trucking Company",
    DRIVER:     "Independent Truck Driver",
    CONTRACTOR: "Contractor (legacy)",
    PIT_OWNER:  "Pit Owner",
    ADMIN:      "Admin",
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Read-only fields */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Email</label>
          <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-500">{initial.email}</div>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Account Type</label>
          <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-500">{roleLabel[initial.role] ?? initial.role}</div>
        </div>
      </div>

      {/* Editable fields */}
      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Full Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your full name"
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Company</label>
          <input
            type="text"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Company name"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Phone</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(555) 000-0000"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="bg-amber-600 text-white px-6 py-2.5 rounded-xl font-semibold text-sm hover:bg-amber-700 disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
        {saved && <span className="text-sm text-green-600 font-medium">✓ Saved</span>}
      </div>

      <p className="text-xs text-gray-400">
        Member since {new Date(initial.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
      </p>
    </form>
  );
}
