"use client";

import { useState } from "react";

export default function SavePitButton({
  pitId,
  initialSaved,
}: {
  pitId: string;
  initialSaved: boolean;
}) {
  const [saved, setSaved] = useState(initialSaved);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    try {
      if (saved) {
        await fetch(`/api/saved-pits/${pitId}`, { method: "DELETE" });
        setSaved(false);
      } else {
        await fetch(`/api/saved-pits/${pitId}`, { method: "POST" });
        setSaved(true);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      title={saved ? "Remove from saved pits" : "Save this pit"}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-colors disabled:opacity-50 ${
        saved
          ? "bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100"
          : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
      }`}
    >
      <span>{saved ? "📌" : "🔖"}</span>
      {saved ? "Saved" : "Save Pit"}
    </button>
  );
}
