"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DisputeActions({ loadId }: { loadId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function resolve(action: "verify" | "delete") {
    setLoading(true);
    await fetch(`/api/admin/loads/${loadId}/resolve`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    router.refresh();
    setLoading(false);
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={() => resolve("verify")}
        disabled={loading}
        className="text-xs bg-sky-600 text-white px-2.5 py-1 rounded-lg font-medium hover:bg-sky-700 disabled:opacity-50"
      >
        Verify
      </button>
      <button
        onClick={() => resolve("delete")}
        disabled={loading}
        className="text-xs bg-red-600 text-white px-2.5 py-1 rounded-lg font-medium hover:bg-red-700 disabled:opacity-50"
      >
        Remove
      </button>
    </div>
  );
}
