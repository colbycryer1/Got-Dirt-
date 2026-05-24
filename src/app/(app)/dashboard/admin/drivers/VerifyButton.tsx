"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function VerifyButton({ profileId, verified }: { profileId: string; verified: boolean }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function toggle() {
    setLoading(true);
    await fetch(`/api/admin/drivers/${profileId}/verify`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verified: !verified }),
    });
    router.refresh();
    setLoading(false);
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50
        ${verified
          ? "bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-600"
          : "bg-green-600 text-white hover:bg-green-700"}`}
    >
      {loading ? "…" : verified ? "Revoke" : "Verify"}
    </button>
  );
}
