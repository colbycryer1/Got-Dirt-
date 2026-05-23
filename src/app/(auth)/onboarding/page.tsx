"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function OnboardingPage() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function selectRole(role: "CONTRACTOR" | "PIT_OWNER") {
    setLoading(true);
    await fetch(`/api/users/${session?.user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    await update(); // Refresh JWT session
    router.push(role === "PIT_OWNER" ? "/dashboard/pit-owner" : "/map");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-2xl shadow-lg p-10 w-full max-w-lg text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome to Got Dirt</h1>
        <p className="text-gray-500 mb-10">How will you use the app?</p>

        <div className="grid sm:grid-cols-2 gap-4">
          <button
            disabled={loading}
            onClick={() => selectRole("CONTRACTOR")}
            className="p-6 rounded-2xl border-2 border-gray-200 hover:border-green-500 hover:bg-green-50 transition-all text-left group"
          >
            <div className="text-4xl mb-3">🚛</div>
            <h3 className="text-lg font-semibold text-gray-900 group-hover:text-green-700">
              Contractor / Trucker
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Find pits near my job site or haul route
            </p>
          </button>

          <button
            disabled={loading}
            onClick={() => selectRole("PIT_OWNER")}
            className="p-6 rounded-2xl border-2 border-gray-200 hover:border-green-500 hover:bg-green-50 transition-all text-left group"
          >
            <div className="text-4xl mb-3">⛏️</div>
            <h3 className="text-lg font-semibold text-gray-900 group-hover:text-green-700">
              Pit Owner
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              List my pit and accept payments
            </p>
          </button>
        </div>
      </div>
    </div>
  );
}
