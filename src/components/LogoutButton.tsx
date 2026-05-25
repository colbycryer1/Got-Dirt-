"use client";

import { signOut } from "next-auth/react";
import { useState } from "react";

export default function LogoutButton({ className }: { className?: string }) {
  const [loading, setLoading] = useState(false);

  return (
    <button
      onClick={async () => { setLoading(true); await signOut({ callbackUrl: "/login" }); }}
      disabled={loading}
      className={className ?? "text-sm text-gray-500 hover:text-red-600 transition-colors disabled:opacity-50"}
    >
      {loading ? "Signing out…" : "Sign Out"}
    </button>
  );
}
