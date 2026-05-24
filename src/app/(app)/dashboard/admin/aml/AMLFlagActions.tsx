"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AMLFlagActions({ flagId }: { flagId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function resolve(resolution: "CLEARED" | "ESCALATED" | "REPORTED") {
    setLoading(true);
    await fetch(`/api/admin/aml-flags/${flagId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolution }),
    });
    router.refresh();
    setLoading(false);
  }

  return (
    <div className="flex gap-1.5">
      <button
        onClick={() => resolve("CLEARED")}
        disabled={loading}
        className="text-xs bg-green-600 text-white px-2 py-1 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
      >
        Clear
      </button>
      <button
        onClick={() => resolve("ESCALATED")}
        disabled={loading}
        className="text-xs bg-amber-500 text-white px-2 py-1 rounded-lg font-medium hover:bg-amber-600 disabled:opacity-50"
      >
        Escalate
      </button>
      <button
        onClick={() => resolve("REPORTED")}
        disabled={loading}
        className="text-xs bg-red-600 text-white px-2 py-1 rounded-lg font-medium hover:bg-red-700 disabled:opacity-50"
      >
        SAR
      </button>
    </div>
  );
}
