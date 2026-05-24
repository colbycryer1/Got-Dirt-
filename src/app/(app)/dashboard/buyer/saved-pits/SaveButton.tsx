"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SaveButton({ pitId, saved: initialSaved }: { pitId: string; saved: boolean }) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    if (saved) {
      await fetch(`/api/saved-pits/${pitId}`, { method: "DELETE" });
      setSaved(false);
    } else {
      await fetch(`/api/saved-pits/${pitId}`, { method: "POST" });
      setSaved(true);
    }
    setLoading(false);
    router.refresh();
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      title={saved ? "Remove from saved pits" : "Save this pit"}
      className={`shrink-0 p-2 rounded-lg transition-colors disabled:opacity-50 ${
        saved
          ? "bg-amber-100 text-amber-600 hover:bg-amber-200"
          : "bg-gray-100 text-gray-400 hover:bg-gray-200"
      }`}
    >
      {saved ? "📌" : "🔖"}
    </button>
  );
}
