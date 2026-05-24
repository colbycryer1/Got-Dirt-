"use client";

import { useState, useEffect } from "react";

interface Props {
  enabled: boolean;
  lat:     number | null;
  lng:     number | null;
}

export default function LocationToggle({ enabled: initialEnabled, lat: initialLat, lng: initialLng }: Props) {
  const [enabled, setEnabled]   = useState(initialEnabled);
  const [saving,  setSaving]    = useState(false);
  const [error,   setError]     = useState("");
  const [lastLat, setLastLat]   = useState(initialLat);
  const [lastLng, setLastLng]   = useState(initialLng);

  // Push position updates every 2 minutes while live
  useEffect(() => {
    if (!enabled) return;
    const push = () => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition((pos) => {
        const { latitude, longitude } = pos.coords;
        setLastLat(latitude);
        setLastLng(longitude);
        fetch("/api/driver/location", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: true, lat: latitude, lng: longitude }),
        }).catch(() => {});
      });
    };
    push();
    const interval = setInterval(push, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [enabled]);

  async function toggle() {
    setSaving(true);
    setError("");
    try {
      if (!enabled && !navigator.geolocation) {
        setError("Geolocation is not supported by your browser.");
        return;
      }

      if (!enabled) {
        // Get position before enabling
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const { latitude, longitude } = pos.coords;
            const res = await fetch("/api/driver/location", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ enabled: true, lat: latitude, lng: longitude }),
            });
            if (res.ok) { setEnabled(true); setLastLat(latitude); setLastLng(longitude); }
            setSaving(false);
          },
          () => { setError("Location permission denied."); setSaving(false); }
        );
      } else {
        const res = await fetch("/api/driver/location", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: false }),
        });
        if (res.ok) { setEnabled(false); setLastLat(null); setLastLng(null); }
        setSaving(false);
      }
    } catch {
      setError("Failed to update location. Please try again.");
      setSaving(false);
    }
  }

  return (
    <div className={`rounded-2xl border p-5 transition-colors ${enabled ? "bg-green-50 border-green-200" : "bg-white border-gray-200"}`}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${enabled ? "bg-green-500 animate-pulse" : "bg-gray-300"}`} />
            <p className="font-semibold text-gray-900">Live Location</p>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            {enabled
              ? lastLat ? `Broadcasting · ${lastLat.toFixed(4)}, ${lastLng?.toFixed(4)}` : "Acquiring position…"
              : "Enable to appear on the buyer map and receive nearby haul requests"}
          </p>
          {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
        </div>
        <button
          onClick={toggle}
          disabled={saving}
          className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50
            ${enabled ? "bg-green-500" : "bg-gray-200"}`}
        >
          <span
            className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform duration-200
              ${enabled ? "translate-x-5" : "translate-x-0"}`}
          />
        </button>
      </div>
    </div>
  );
}
