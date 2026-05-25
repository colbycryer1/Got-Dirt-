"use client";

import { useState, useEffect } from "react";

interface Props {
  enabled: boolean;
  lat:     number | null;
  lng:     number | null;
}

export default function LocationToggle({ enabled: initialEnabled, lat: initialLat, lng: initialLng }: Props) {
  const [enabled,      setEnabled]      = useState(initialEnabled);
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState("");
  const [lastLat,      setLastLat]      = useState(initialLat);
  const [lastLng,      setLastLng]      = useState(initialLng);
  const [showConsent,  setShowConsent]  = useState(false);

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

  async function enableWithPosition() {
    setSaving(true);
    setError("");
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
  }

  async function toggle() {
    if (!enabled) {
      // Show consent modal before enabling
      if (!navigator.geolocation) {
        setError("Geolocation is not supported by your browser.");
        return;
      }
      setShowConsent(true);
      return;
    }

    // Disable immediately
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/driver/location", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: false }),
      });
      if (res.ok) { setEnabled(false); setLastLat(null); setLastLng(null); }
    } catch {
      setError("Failed to update location. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function handleConsentAgree() {
    setShowConsent(false);
    enableWithPosition();
  }

  return (
    <>
      {/* Consent Modal */}
      {showConsent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📍</span>
              <h2 className="text-lg font-bold text-gray-900">Enable Live Location?</h2>
            </div>
            <p className="text-sm text-gray-600">
              Got Dirt? will use your device GPS to:
            </p>
            <ul className="text-sm text-gray-600 space-y-1.5 pl-4 list-disc">
              <li>Show your truck on the buyer map for nearby haul requests</li>
              <li>Track when you arrive and leave job sites</li>
              <li>Enable GPS-verified load logging (you must be stationary)</li>
              <li>Provide an independent load count for dispute resolution</li>
            </ul>
            <p className="text-sm text-gray-500">
              Your location is only shared while this toggle is on. You can turn it off at any time.
            </p>
            <a
              href="/guidelines/location-tracking"
              className="text-xs text-amber-600 underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              View Location Data Guidelines →
            </a>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowConsent(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConsentAgree}
                className="flex-1 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700"
              >
                I Agree — Enable
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toggle Card */}
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
                : "Enable to appear on the buyer map and unlock GPS load logging"}
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
    </>
  );
}
