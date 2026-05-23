"use client";

import { useState } from "react";

interface Props {
  pitId: string;
  initialAccepting: boolean;
}

export function PitStatusToggle({ pitId, initialAccepting }: Props) {
  const [accepting, setAccepting] = useState(initialAccepting);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    const res = await fetch(`/api/pits/${pitId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accepting: !accepting }),
    });
    if (res.ok) setAccepting(!accepting);
    setLoading(false);
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold transition-colors ${
        accepting
          ? "bg-green-100 text-green-700 hover:bg-green-200"
          : "bg-red-100 text-red-700 hover:bg-red-200"
      } disabled:opacity-50`}
    >
      <span className={`w-2 h-2 rounded-full ${accepting ? "bg-green-500" : "bg-red-500"}`} />
      {loading ? "…" : accepting ? "Open" : "Closed"}
    </button>
  );
}
