"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type AccountRole = "BUYER" | "CARRIER" | "DRIVER" | "PIT_OWNER";

const ACCOUNT_TYPES: {
  role: AccountRole;
  icon: string;
  label: string;
  description: string;
}[] = [
  {
    role: "BUYER",
    icon: "🏗️",
    label: "Direct Buyer",
    description: "Find pits, manage projects, schedule hauls, and track loads",
  },
  {
    role: "CARRIER",
    icon: "🚚",
    label: "3PL / Trucking Company",
    description: "Market your fleet, post haul rates, and receive haul orders from buyers",
  },
  {
    role: "DRIVER",
    icon: "🧑‍✈️",
    label: "Independent Truck Driver",
    description: "Post your profile, haul rates, and truck type — get hired directly by buyers",
  },
  {
    role: "PIT_OWNER",
    icon: "⛏️",
    label: "Pit Owner",
    description: "List your pit, set rates, and accept load payments",
  },
];

export default function OnboardingPage() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<AccountRole | null>(null);

  async function selectRole(role: AccountRole) {
    setSelected(role);
    setLoading(true);
    await fetch(`/api/users/${session?.user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    await update();

    if (role === "PIT_OWNER") router.push("/dashboard/pit-owner/pits");
    else if (role === "DRIVER") router.push("/dashboard/driver");
    else router.push("/dashboard/buyer");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="bg-white rounded-2xl shadow-lg p-10 w-full max-w-2xl text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome to Got Dirt?</h1>
        <p className="text-gray-500 mb-10">How will you use the app?</p>

        <div className="grid sm:grid-cols-2 gap-4">
          {ACCOUNT_TYPES.map(({ role, icon, label, description }) => (
            <button
              key={role}
              disabled={loading}
              onClick={() => selectRole(role)}
              className={`p-6 rounded-2xl border-2 transition-all text-left group
                ${selected === role
                  ? "border-amber-500 bg-amber-50"
                  : "border-gray-200 hover:border-amber-500 hover:bg-amber-50"}
                ${loading && selected !== role ? "opacity-40 cursor-not-allowed" : ""}`}
            >
              <div className="text-4xl mb-3">{icon}</div>
              <h3 className="text-lg font-semibold text-gray-900 group-hover:text-amber-700">
                {label}
              </h3>
              <p className="text-sm text-gray-500 mt-1">{description}</p>
            </button>
          ))}
        </div>

        {loading && (
          <p className="text-sm text-gray-400 mt-6">Setting up your account…</p>
        )}
      </div>
    </div>
  );
}
